import { Guild } from 'discord.js';
import { RateLimitManager } from 'klasa';
import { GuildSettings } from '../../types/settings/GuildSettings';
import { Adder } from '../Adder';
import { PreciseTimeout } from '../PreciseTimeout';
import { AntiRaid } from './AntiRaid';
import { ModerationActions } from './ModerationActions';
import { create } from './RegexCreator';

export interface Adders {
	attachments: Adder<string> | null;
	capitals: Adder<string> | null;
	links: Adder<string> | null;
	messages: Adder<string> | null;
	newlines: Adder<string> | null;
	invites: Adder<string> | null;
	words: Adder<string> | null;
	reactions: Adder<string> | null;
}

/**
 * @version 3.0.0
 */
export class GuildSecurity {

	/**
	 * The SkyraGuild instance which manages this instance
	 */
	public guild: Guild;

	/**
	 * The anti-spam adders used to control spam
	 */
	public adders: Adders = {
		attachments: null,
		capitals: null,
		links: null,
		messages: null,
		newlines: null,
		invites: null,
		words: null,
		reactions: null
	};

	public actions: ModerationActions;

	/**
	 * The AntiRaid instance managed by this guild, if exists
	 */
	public raid: AntiRaid;

	/**
	 * The ratelimit management for the no-mention-spam behavior
	 */
	public nms: RateLimitManager;

	/**
	 * The lockdowns map
	 */
	public lockdowns: Map<string, PreciseTimeout | null> = new Map();

	/**
	 * The RegExp
	 */
	public regexp: RegExp | null = null;

	public constructor(guild: Guild) {
		this.guild = guild;
		this.actions = new ModerationActions(this.guild);
		this.raid = new AntiRaid(this.guild);
		this.nms = new RateLimitManager(
			this.guild.settings.get(GuildSettings.NoMentionSpam.MentionsAllowed),
			this.guild.settings.get(GuildSettings.NoMentionSpam.TimePeriod) * 1000
		);
	}

	/**
	 * Build a super RegExp from an array
	 * @param filterArray The array to process
	 */
	public updateRegExp(filterArray: readonly string[]) {
		this.regexp = new RegExp(create(filterArray), 'gi');
		return this;
	}

}
