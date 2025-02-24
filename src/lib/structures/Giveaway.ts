import { DiscordAPIError, HTTPError, MessageEmbed } from 'discord.js';
import { Language } from 'klasa';
import { FetchError } from 'node-fetch';
import { CLIENT_ID } from '../../../config';
import { Events } from '../types/Enums';
import { Time, APIErrors } from '../util/constants';
import { fetchReactionUsers, resolveEmoji } from '../util/util';
import { GiveawayManager } from './GiveawayManager';
import { api } from '../util/Models/Api';
import { RawGiveawaySettings } from '../types/settings/raw/RawGiveawaySettings';

enum States {
	Running,
	LastChance,
	Finished
}

export enum Colors {
	Blue = 0x47C7F7,
	Orange = 0xFFA721,
	Red = 0xE80F2B
}

export const GiveawayEmoji = '🎉';

export class Giveaway {

	public store: GiveawayManager;
	public endsAt: number;
	public refreshAt: number;
	public title: string;
	public minimum: number;
	public minimumWinners: number;
	public messageID: string | null;
	public channelID: string;
	public guildID: string;
	public finished = false;
	private winners: string[] | null = null;
	private paused = false;
	private rendering = false;

	public constructor(store: GiveawayManager, data: PartialRawGiveawaySettings) {
		this.store = store;
		this.title = data.title;
		this.endsAt = data.ends_at;
		this.channelID = data.channel_id;
		this.guildID = data.guild_id;
		this.messageID = data.message_id;
		this.minimum = data.minimum;
		this.minimumWinners = data.minimum_winners;
		this.refreshAt = this.calculateNextRefresh();
	}

	public get client() {
		return this.store.client;
	}

	public get guild() {
		return this.store.client.guilds.get(this.guildID) || null;
	}

	public get language() {
		const { guild } = this;
		return guild ? guild.language : null;
	}

	public get remaining() {
		return Math.max(this.endsAt - Date.now(), 0);
	}

	private get state() {
		const { remaining } = this;
		if (remaining <= 0) return States.Finished;
		if (remaining < Time.Second * 20) return States.LastChance;
		return States.Running;
	}

	public async init() {
		this.pause();

		// Create the message
		const message = await api(this.store.client).channels(this.channelID).messages.post({ data: await this.getData() }) as { id: string };
		this.messageID = message.id;
		this.resume();

		// Add a reaction to the message and save to database
		await api(this.store.client)
			.channels(this.channelID)
			.messages(this.messageID)
			.reactions(Giveaway.EMOJI, '@me')
			.put();
		await this.client.queries.insertGiveaway(this.toJSON());
		return this;
	}

	public async render() {
		// TODO(kyranet): Make a promise queue, if there are 1 or more pending edits
		// on heavy ratelimits, skip all of them and unshift the last edit

		// Skip early if it's already rendering
		if (this.paused || this.rendering) return this;
		this.rendering = true;

		try {
			await api(this.store.client)
				.channels(this.channelID)
				.messages(this.messageID!)
				.patch({ data: await this.getData() });
		} catch (error) {
			if (error instanceof DiscordAPIError) {
				if (error.code === APIErrors.UnknownMessage || error.code === APIErrors.MissingAccess || error.code === APIErrors.InvalidFormBody) {
					await this.destroy();
				} else {
					this.store.client.emit(Events.ApiError, error);
				}
			}
		}

		// Set self rendering to false
		this.rendering = false;
		return this;
	}

	public resume() {
		this.paused = false;
		return this;
	}

	public pause() {
		this.paused = true;
		return this;
	}

	public async finish() {
		this.finished = true;
		await this.store.client.queries.deleteGiveaway(this.guildID, this.messageID!);
		return this;
	}

	public async destroy() {
		await this.finish();
		if (this.messageID) {
			try {
				await api(this.store.client)
					.channels(this.channelID)
					.messages(this.messageID)
					.delete();
			} catch (error) {
				if (error instanceof DiscordAPIError) {
					if (error.code === APIErrors.UnknownMessage || error.code === APIErrors.UnknownEmoji) return this;
				}
				this.store.client.emit(Events.ApiError, error);
			}
		}
		return this;
	}

	public toJSON(): RawGiveawaySettings {
		if (this.messageID === null) throw new TypeError('Cannot serialize Giveaway without instantiation.');
		return {
			channel_id: this.channelID,
			ends_at: this.endsAt,
			guild_id: this.guildID,
			message_id: this.messageID,
			minimum: this.minimum,
			minimum_winners: this.minimumWinners,
			title: this.title
		};
	}

	private async getData() {
		const { state, language } = this;
		if (state === States.Finished) {
			await this.finish();
			this.winners = await this.pickWinners();
			await this.announceWinners(language!);
		} else {
			this.refreshAt = this.calculateNextRefresh();
		}
		const content = Giveaway.getContent(state, language!);
		const embed = this.getEmbed(state, language!);
		return { content, embed };
	}

	private async announceWinners(language: Language) {
		const content = this.winners
			? language.tget('GIVEAWAY_ENDED_MESSAGE', this.winners.map(winner => `<@${winner}>`), this.title)
			: language.tget('GIVEAWAY_ENDED_MESSAGE_NO_WINNER', this.title);
		try {
			await api(this.store.client).channels(this.channelID).messages.post({ data: { content } });
		} catch (error) {
			this.store.client.emit(Events.ApiError, error);
		}
	}

	private getEmbed(state: States, language: Language) {
		const description = this.getDescription(state, language);
		const footer = Giveaway.getFooter(state, language);
		return new MessageEmbed()
			.setColor(Giveaway.getColor(state))
			.setTitle(this.title)
			.setDescription(description)
			.setFooter(footer)
			.setTimestamp(this.endsAt)
			// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
			// @ts-ignore 2341
			._apiTransform();
	}

	private getDescription(state: States, language: Language) {
		switch (state) {
			case States.Finished: return this.winners && this.winners.length
				? language.tget('GIVEAWAY_ENDED', this.winners.map(winner => `<@${winner}>`))
				: language.tget('GIVEAWAY_ENDED_NO_WINNER');
			case States.LastChance: return language.tget('GIVEAWAY_LASTCHANCE', this.remaining);
			default: return language.tget('GIVEAWAY_DURATION', this.remaining);
		}
	}

	private calculateNextRefresh() {
		const { remaining } = this;
		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		if (remaining < Time.Second * 5) return Date.now() + Time.Second;
		if (remaining < Time.Second * 30) return Date.now() + Math.min(remaining - (Time.Second * 6), Time.Second * 5);
		if (remaining < Time.Minute * 2) return Date.now() + (Time.Second * 15);
		if (remaining < Time.Minute * 5) return Date.now() + (Time.Second * 20);
		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		if (remaining < Time.Minute * 15) return Date.now() + Time.Minute;
		if (remaining < Time.Minute * 30) return Date.now() + (Time.Minute * 2);
		return Date.now() + (Time.Minute * 5);
	}

	private async pickWinners() {
		const participants = await this.fetchParticipants();
		if (participants.length < this.minimum) return null;

		let m = participants.length;
		while (m) {
			const i = Math.floor(Math.random() * m--);
			[participants[m], participants[i]] = [participants[i], participants[m]];
		}
		return participants.slice(0, this.minimumWinners);
	}

	private async fetchParticipants(): Promise<string[]> {
		try {
			const users = await fetchReactionUsers(this.store.client, this.channelID, this.messageID!, Giveaway.EMOJI);
			users.delete(CLIENT_ID);
			return [...users];
		} catch (error) {
			if (error instanceof DiscordAPIError) {
				if (error.code === APIErrors.UnknownMessage || error.code === APIErrors.UnknownEmoji) return [];
			} else if (error instanceof HTTPError || error instanceof FetchError) {
				if (error.code === 'ECONNRESET') return this.fetchParticipants();
				this.store.client.emit(Events.ApiError, error);
			}
			return [];
		}
	}

	public static EMOJI = resolveEmoji(GiveawayEmoji)!;

	private static getContent(state: States, language: Language) {
		switch (state) {
			case States.Finished: return language.tget('GIVEAWAY_ENDED_TITLE');
			case States.LastChance: return language.tget('GIVEAWAY_LASTCHANCE_TITLE');
			default: return language.tget('GIVEAWAY_TITLE');
		}
	}

	private static getColor(state: States) {
		switch (state) {
			case States.Finished: return Colors.Red;
			case States.LastChance: return Colors.Orange;
			default: return Colors.Blue;
		}
	}

	private static getFooter(state: States, language: Language) {
		return state === States.Running
			? language.tget('GIVEAWAY_ENDS_AT')
			: language.tget('GIVEAWAY_ENDED_AT');
	}

}

export type GiveawayCreateData = Omit<RawGiveawaySettings, 'message_id'>;
export type PartialRawGiveawaySettings = GiveawayCreateData & { message_id: RawGiveawaySettings['message_id'] | null };
