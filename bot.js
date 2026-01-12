// ================================
// FULL DISCORD BOT WITH FIXED CET/CEST + EMBEDS
// ================================

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  AttachmentBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const fs = require('fs');
const mongoose = require('mongoose');

// ================================
// TIMEZONE HELPER (CET / CEST SAFE)
// ================================

function parseBerlinDate(when) {
  const match = when.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, d, m, y, hh, mm] = match.map(Number);
  const year = 2000 + y;

  const utcGuess = new Date(Date.UTC(year, m - 1, d, hh, mm, 0));
  const berlinAsUTC = new Date(
    utcGuess.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
  );

  const offsetMs = utcGuess.getTime() - berlinAsUTC.getTime();
  return new Date(utcGuess.getTime() + offsetMs);
}

// ================================
// CLIENT SETUP
// ================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================================
// WORD LISTS / REACTIONS
// ================================

const targetWords = ['füssen', 'fuss', 'fuß', 'foot', 'voeten', 'voet'];
const larsonWords = ['kyle larson', 'larson'];
const franceWords = ['france', '🇫🇷', 'french'];
const maxWords = ['max', 'max verstappen', 'verstappen', 'maximilian', 'maggs'];
const landoWords = ['lando', 'norris', 'lando norris', 'lando no rizz'];
const tutututuWords = ['tututu', 'tödödö'];
const grrWords = ['törken', 'franzosen', 'nederlanders', 'niederländer'];
const germanWords = ['duits', 'deutsch', 'deutschland', 'german', 'duitsers', 'arier'];
const wannCsWords = ['wann cs'];

const grrrUserId = '629336494015905792';

// ================================
// DATABASE
// ================================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(console.error);

const reminderSchema = new mongoose.Schema({
  userId: String,
  channelId: String,
  guildId: String,
  message: String,
  remindAt: Date,
  pinged: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Reminder = mongoose.model('Reminder', reminderSchema);

// ================================
// READY EVENT
// ================================

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    { name: 'schedule', description: 'Shows the special events schedule' },
    {
      name: 'remind',
      description: 'Set a reminder',
      options: [
        { name: 'type', description: 'time or date', type: 3, required: true, choices: [
          { name: 'time', value: 'time' },
          { name: 'date', value: 'date' }
        ]},
        { name: 'when', description: 'minutes OR DD.MM.YY HH:MM', type: 3, required: true },
        { name: 'message', description: 'What to remind you about', type: 3, required: true },
        { name: 'get_pinged', description: 'Ping you when the reminder fires', type: 5, required: false }
      ]
    },
    { name: 'remind-embed', description: 'Set a reminder with an embed' }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  setInterval(checkReminders, 60_000);
});

// ================================
// MESSAGE CREATE (REACTIONS)
// ================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const lower = message.content.toLowerCase();

  if (targetWords.some(w => lower.includes(w))) await message.react('🤤');

  if (maxWords.some(w => lower.includes(w))) {
    await message.react('🤤');
    await message.react('🇳🇱');
    await message.channel.send('TUTUTUTU');
  }

  if (landoWords.some(w => lower.includes(w))) {
    await message.react('🤮');
    await message.react('🌈');
  }

  if (tutututuWords.some(w => lower.includes(w))) {
    await message.channel.send('MAX VERSTAPPEN');
  }

  if (grrWords.some(w => lower.includes(w)) || message.author.id === grrrUserId) {
    await message.react('1442859255748362261');
  }

  if (germanWords.some(w => lower.includes(w)) || /\bdb\b/i.test(message.content)) {
    await message.react('1403499851739828356');
  }

  if (wannCsWords.some(w => lower.includes(w))) {
    await message.channel.send('Jetzt!');
  }
});

// ================================
// INTERACTIONS
// ================================

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'schedule') {
      if (!fs.existsSync('./specialevents.webp')) return interaction.reply('No schedule found');
      return interaction.reply({ files: [new AttachmentBuilder('./specialevents.webp')] });
    }

    if (interaction.commandName === 'remind') {
      const type = interaction.options.getString('type');
      const when = interaction.options.getString('when');
      const message = interaction.options.getString('message');
      const pinged = interaction.options.getBoolean('get_pinged') ?? true;

      let remindAt;

      if (type === 'time') {
        const minutes = parseInt(when, 10);
        if (!minutes || minutes <= 0) return interaction.reply('Invalid minutes');
        remindAt = new Date(Date.now() + minutes * 60000);
      } else {
        remindAt = parseBerlinDate(when);
        if (!remindAt) return interaction.reply('Invalid date format');
        if (remindAt < new Date()) return interaction.reply('Date is in the past');
      }

      await new Reminder({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        message,
        remindAt,
        pinged
      }).save();

      const berlin = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      return interaction.reply(`Reminder set for ${berlin}`);
    }

    if (interaction.commandName === 'remind-embed') {
      const modal = new ModalBuilder().setCustomId('reminder-modal').setTitle('Embed Reminder');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('type').setLabel('time or date').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('when').setLabel('minutes OR DD.MM.YY HH:MM').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('pinged').setLabel('get pinged? true / false').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('embed').setLabel('Embed JSON').setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'reminder-modal') {
    const type = interaction.fields.getTextInputValue('type');
    const when = interaction.fields.getTextInputValue('when');
    const embedRaw = interaction.fields.getTextInputValue('embed');
    const pingedRaw = interaction.fields.getTextInputValue('pinged');
    const pinged = pingedRaw ? pingedRaw.toLowerCase() !== 'false' : true;

    let embedJson;
    try { embedJson = JSON.parse(embedRaw); }
    catch { return interaction.reply({ content: 'Invalid JSON', ephemeral: true }); }

    let remindAt;

    if (type === 'time') {
      const minutes = parseInt(when, 10);
      if (!minutes || minutes <= 0) return interaction.reply({ content: 'Invalid minutes', ephemeral: true });
      remindAt = new Date(Date.now() + minutes * 60000);
    } else {
      remindAt = parseBerlinDate(when);
      if (!remindAt || remindAt < new Date()) return interaction.reply({ content: 'Invalid date', ephemeral: true });
    }

    await new Reminder({
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      message: JSON.stringify(embedJson),
      remindAt,
      pinged
    }).save();

    return interaction.reply({ content: 'Embed reminder saved', ephemeral: true });
  }
});

// ================================
// REMINDER CHECKER
// ================================

async function checkReminders() {
  const now = new Date();
  const due = await Reminder.find({ remindAt: { $lte: now } });

  for (const r of due) {
    const channel = await client.channels.fetch(r.channelId).catch(() => null);
    if (!channel) continue;

    try {
      const json = JSON.parse(r.message);
      const embeds = Array.isArray(json.embeds)
        ? json.embeds.map(e => EmbedBuilder.from(e))
        : [EmbedBuilder.from(json.embed ?? json)];

      await channel.send({ content: r.pinged ? `<@${r.userId}>` : undefined, embeds });
    } catch {
      await channel.send(r.pinged ? `<@${r.userId}> ${r.message}` : r.message);
    }

    await Reminder.deleteOne({ _id: r._id });
  }
}

// ================================
// LOGIN
// ================================

client.login(process.env.DISCORD_BOT_TOKEN);
 