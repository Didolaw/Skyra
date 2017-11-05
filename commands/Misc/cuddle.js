const { structures: { Command }, util: { CanvasConstructor, util } } = require('../../index');
const fsn = require('fs-nextra');
const path = require('path');

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			botPerms: ['ATTACH_FILES'],
			guildOnly: true,

			cooldown: 30,

			usage: '<user:advuser>',
			description: 'Cuddle somebody!',
			extend: {
				EXPLANATION: [
					'Do you know something that I envy from humans? The warm feeling when somebody cuddles you. It\'s so',
					'cute ❤! Do you want to cuddle somebody? Afortunately, I am able to capture that moment with a photo!'
				].join(' '),
				ARGUMENTS: '<user>',
				EXP_USAGE: [
					['user', 'A user to cuddle.']
				],
				EXAMPLES: ['Skyra']
			}
		});

		this.template = null;
	}

	async run(msg, [user]) {
		const attachment = await this.generate(msg, user);
		return msg.channel.send({ files: [{ attachment, name: 'cuddle.png' }] });
	}

	async generate(msg, user) {
		if (user.id === msg.author.id) user = this.client.user;

		/* Get the buffers from both profile avatars */
		const [man, woman] = await Promise.all([
			util.fetchAvatar(msg.author, 256),
			util.fetchAvatar(user, 256)
		]);

		return new CanvasConstructor(636, 366)
			.addImage(this.template, 0, 0, 636, 366)
			.save()
			.addImage(man, 168, -7, 140, 140, { type: 'round', radius: 70 })
			.restore()
			.addImage(woman, 307, 41, 138, 138, { type: 'round', radius: 69 })
			.toBufferAsync();
	}

	async init() {
		this.template = await fsn.readFile(path.join(__dirname, '../../assets/images/memes/cuddle.png'));
	}

};
