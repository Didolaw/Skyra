import { Extendable, ExtendableStore } from 'klasa';
import { Message, TextChannel } from 'discord.js';

const snipes = new WeakMap<TextChannel, SnipedMessage>();

export default class extends Extendable {

	public constructor(store: ExtendableStore, file: string[], directory: string) {
		super(store, file, directory, { appliesTo: [TextChannel] });
	}

	public set sniped(this: TextChannel, value: Message | null) {
		const previous = snipes.get(this);
		if (typeof previous !== 'undefined') this.client.clearTimeout(previous.timeout);

		if (value === null) {
			snipes.delete(this);
		} else {
			const next: SnipedMessage = {
				message: value,
				timestamp: Date.now(),
				timeout: this.client.setTimeout(() => snipes.delete(this), 15000)
			};
			snipes.set(this, next);
		}
	}

	public get sniped(this: TextChannel) {
		const current = snipes.get(this);
		return typeof current === 'undefined' ? null : current.message;
	}

}

export interface SnipedMessage {
	message: Message;
	timestamp: number;
	timeout: NodeJS.Timeout;
}
