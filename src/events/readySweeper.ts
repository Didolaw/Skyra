import { Event, EventStore } from 'klasa';
import { Events } from '../lib/types/Enums';

const HEADER = `\u001B[39m\u001B[94m[MEMORY CLEANUP]\u001B[39m\u001B[90m`;

export default class extends Event {

	public constructor(store: EventStore, file: string[], directory: string) {
		super(store, file, directory, { event: 'ready', once: true });
	}

	public run() {
		this.client.emit(Events.Verbose, `${HEADER} Running initial sweep...`);

		const users = this.client.users.size;
		let presences = 0;
		let guildMembers = 0;

		// Populate the usernames
		for (const user of this.client.users.values()) {
			this.client.userTags.create(user);
		}

		// Clear all users
		this.client.users.clear();

		// Fill the dictionary name for faster user fetching
		for (const guild of this.client.guilds.values()) {
			const { me } = guild;

			// Populate the snowflakes
			for (const member of guild.members.values()) {
				guild.memberTags.create(member);
			}

			// Update counters
			guildMembers += guild.members.size - 1;
			presences += guild.presences.size;

			// Clear all members
			guild.presences.clear();

			guild.members.clear();
			if (me) guild.members.set(me.id, me);
		}

		this.client.emit(Events.Verbose, `${HEADER} ${
			this.setColor(presences)} [Presence]s | ${
			this.setColor(guildMembers)} [GuildMember]s | ${
			this.setColor(users)} [User]s`);
	}

	public setColor(n: number) {
		const text = String(n).padStart(5, ' ');
		// Light Red color
		if (n > 1000) return `\u001B[39m\u001B[91m${text}\u001B[39m\u001B[90m`;
		// Light Yellow color
		if (n > 100) return `\u001B[39m\u001B[93m${text}\u001B[39m\u001B[90m`;
		// Green color
		return `\u001B[39m\u001B[32m${text}\u001B[39m\u001B[90m`;
	}

}
