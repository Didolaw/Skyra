const { Command } = require('../../index');

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			description: (language) => language.get('COMMAND_TAGMANAGER_DESCRIPTION'),
			extendedHelp: (language) => language.get('COMMAND_TAGMANAGER_EXTENDED'),
			permissionLevel: 4,
			runIn: ['text'],
			subcommands: true,
			usage: '<add|edit|remove> <tag:string> [contents:string] [...]',
			usageDelim: ' '
		});
	}

	async add(msg, [tag, ...contents]) {
		tag = tag.toLowerCase();

		const currentTags = msg.guild.configs.tags;
		if (currentTags.has(tag)) throw msg.language.get('COMMAND_TAGS_ADD_EXISTS', tag);
		if (!contents.length) throw msg.language.get('COMMAND_TAGS_CONTENT_REQUIRED');

		contents = contents.join(' ');
		currentTags.set(tag, contents);
		const { errors } = await msg.guild.configs.update('_tags', [...currentTags]);
		if (errors.length) throw errors[0];
		return msg.sendLocale('COMMAND_TAGS_ADD_ADDED', [tag, contents]);
	}

	async edit(msg, [tag, ...contents]) {
		tag = tag.toLowerCase();

		const currentTags = msg.guild.configs.tags;
		const oldTag = currentTags.get(tag);
		if (!oldTag) throw msg.language.get('COMMAND_TAGS_REMOVE_NOT_EXISTS', tag);
		if (!contents.length) throw msg.language.get('COMMAND_TAGS_CONTENT_REQUIRED');

		contents = contents.join(' ');
		currentTags.set(tag, contents);
		const { errors } = await msg.guild.configs.update('_tags', [...currentTags]);
		if (errors.length) throw errors[0];
		return msg.sendLocale('COMMAND_TAGS_EDITED', [tag, contents, oldTag]);
	}

	async remove(msg, [tag]) {
		tag = tag.toLowerCase();

		const currentTags = msg.guild.configs.tags;
		if (!currentTags.has(tag)) throw msg.language.get('COMMAND_TAGS_REMOVE_NOT_EXISTS', tag);
		currentTags.delete(tag);
		const { errors } = await msg.guild.configs.update('_tags', [...currentTags]);
		if (errors.length) throw errors[0];
		return msg.sendLocale('COMMAND_TAGS_REMOVE_REMOVED', [tag]);
	}

};
