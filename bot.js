// FIXES APPLIED:
// 1) Correct CET/CEST handling using Europe/Berlin consistently (no +1h drift)
// 2) Properly build embeds from discohook-style JSON (EmbedBuilder.from, embeds[] support)

const { Client, GatewayIntentBits, REST, Routes, AttachmentBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const mongoose = require('mongoose');

// -------------------- HELPERS --------------------

// Parse a DD.MM.YY HH:MM string as Europe/Berlin local time and return a Date (UTC-correct)
function parseBerlinDate(when) {
  const match = when.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, d, m, y, hh, mm] = match.map(Number);
  const year = 2000 + y;

  // Create a UTC date with the same wall-clock values
  const utcGuess = new Date(Date.UTC(year, m - 1, d, hh, mm, 0));

  // Find the Berlin offset at that moment
  const berlinAsUTC = new Date(utcGuess.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const offsetMs = utcGuess.getTime() - berlinAsUTC.getTime();

  // Subtract offset to get the true UTC instant for Berlin local time
  return new Date(utcGuess.getTime() + offsetMs);
}

// Build embeds safely from JSON (supports discohook exports)
function buildEmbedsFromJson(json) {
  if (Array.isArray(json.embeds)) {
    return json.embeds.map(e => EmbedBuilder.from(e));
  }
  if (json.embed) {
    return [EmbedBuilder.from(json.embed)];
  }
  // Single embed object
  return [EmbedBuilder.from(json)];
}

// -------------------- CLIENT --------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

const reminderSchema = new mongoose.Schema({
  userId: String,
  channelId: String,
  guildId: String,
  message: String, // text OR raw embed JSON string
  remindAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const Reminder = mongoose.model('Reminder', reminderSchema);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

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
        { name: 'message', description: 'Reminder text', type: 3, required: true }
      ]
    },
    { name: 'remind-embed', description: 'Set a reminder with an embed' }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  setInterval(checkReminders, 60_000);
});

// -------------------- SLASH COMMANDS --------------------

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'schedule') {
      if (!fs.existsSync('./specialevents.webp')) {
        return interaction.reply('Schedule image not found!');
      }
      return interaction.reply({ files: [new AttachmentBuilder('./specialevents.webp')] });
    }

    if (interaction.commandName === 'remind') {
      const type = interaction.options.getString('type');
      const when = interaction.options.getString('when');
      const message = interaction.options.getString('message');

      let remindAt;
      if (type === 'time') {
        const minutes = parseInt(when, 10);
        if (!Number.isInteger(minutes) || minutes <= 0) {
          return interaction.reply('Invalid minutes.');
        }
        remindAt = new Date(Date.now() + minutes * 60_000);
      } else {
        remindAt = parseBerlinDate(when);
        if (!remindAt) {
          return interaction.reply('Invalid date format. Use DD.MM.YY HH:MM');
        }
        if (remindAt < new Date()) {
          return interaction.reply('That date is in the past.');
        }
      }

      await new Reminder({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        message,
        remindAt
      }).save();

      const berlin = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      return interaction.reply(`Reminder set for ${berlin} (CET/CEST)`);
    }

    if (interaction.commandName === 'remind-embed') {
      const modal = new ModalBuilder().setCustomId('reminder-modal').setTitle('Set Embed Reminder');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reminder-type').setLabel('time or date').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reminder-when').setLabel('minutes OR DD.MM.YY HH:MM').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reminder-embed').setLabel('Embed JSON (discohook)').setStyle(TextInputStyle.Paragraph).setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }
  }

  // -------------------- MODAL --------------------

  if (interaction.isModalSubmit() && interaction.customId === 'reminder-modal') {
    const type = interaction.fields.getTextInputValue('reminder-type').toLowerCase();
    const when = interaction.fields.getTextInputValue('reminder-when');
    const embedJsonRaw = interaction.fields.getTextInputValue('reminder-embed');

    let embedJson;
    try { embedJson = JSON.parse(embedJsonRaw); }
    catch { return interaction.reply({ content: 'Invalid JSON.', ephemeral: true }); }

    let remindAt;
    if (type === 'time') {
      const minutes = parseInt(when, 10);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        return interaction.reply({ content: 'Invalid minutes.', ephemeral: true });
      }
      remindAt = new Date(Date.now() + minutes * 60_000);
    } else if (type === 'date') {
      remindAt = parseBerlinDate(when);
      if (!remindAt) {
        return interaction.reply({ content: 'Invalid date format.', ephemeral: true });
      }
      if (remindAt < new Date()) {
        return interaction.reply({ content: 'That date is in the past.', ephemeral: true });
      }
    } else {
      return interaction.reply({ content: 'Type must be time or date.', ephemeral: true });
    }

    await new Reminder({
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      message: JSON.stringify(embedJson),
      remindAt
    }).save();

    const berlin = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
    return interaction.reply({ content: `Embed reminder set for ${berlin}`, ephemeral: true });
  }
});

// -------------------- REMINDER DISPATCH --------------------

async function checkReminders() {
  const now = new Date();
  const due = await Reminder.find({ remindAt: { $lte: now } });

  for (const r of due) {
    try {
      const channel = await client.channels.fetch(r.channelId);
      if (!channel) continue;

      const contentPing = `<@${r.userId}>`;

      // Try embed JSON first
      try {
        const json = JSON.parse(r.message);
        const embeds = buildEmbedsFromJson(json);
        await channel.send({ content: contentPing, embeds });
      } catch {
        await channel.send(`${contentPing} Reminder: ${r.message}`);
      }

      await Reminder.deleteOne({ _id: r._id });
    } catch (e) {
      console.error('Reminder send error:', e);
    }
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
