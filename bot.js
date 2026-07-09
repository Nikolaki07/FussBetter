const { Client, GatewayIntentBits, REST, Routes, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const mongoose = require('mongoose');

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Words to detect (case-insensitive, substring match)
const targetWords = ['füssen', 'fuss', 'fuß', 'foot', 'voeten', 'voet', 'feet', 'füsse', 'füße', 'sex', 'gex'];
const larsonWords = ['kyle larson', 'larson'];
const franceWords = ['france', '🇫🇷', 'french'];
const maxWords = ['max', 'max verstappen', 'verstappen', 'maximilian', 'maggs'];
const landoWords = ['lando', 'norris', 'lando norris', 'lando no rizz'];
const tutututuWords = ['tututu', 'tödödö'];
const grrWords = ['törke', 'franzos', 'nederlander', 'niederländer', 'mof'];
const germanWords = ['duits', 'deutsch', 'deutschland', 'german', 'duitsers', 'arier'];
const jobWords = ['placeholder because im retarded'];
const mogusWords = ['among us', 'amog us', 'mogus', 'sus'];
const words1984 = ['1984'];

// Words matched as whole words only (so "wann" doesn't match inside "wanna")
const wannWords = ['wann'];
const wannRustPhrase = 'wann rust';

// User ID to react to with grrr emoji
const grrrUserId = '69420';

// GIFs sent when the "67" meme is detected
const sixSevenGifLinks = [
  'https://giphy.com/gifs/dwcFlb2ovRF3amTpCi',
  'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXd6MmV3Z3J3M2lnZjN0aDM1NXRlMHVvdjR6MnI3bWh6aGN1MXpvMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/08uBcURaMq6vA93TGc/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/RVCJ3vwebUGDpoy7Tm/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/x4sYb64AngRI9QznOA/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XMMUWcz4XtDTNgZj22/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MKUOUJrFldIyi2hJyT/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8rN9VXNb7dfU792YQt/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6lhWhkfSjPSA8actTr/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/x73W03Q8lfTBfeGcY7/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGM2cDRsamhieDE3ZHk0b3d3cnc4YTR6bWI1dWhxZXcyMGt6bTkyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TKa7fQzChHylCQ89to/giphy.gif'
];

// --- Small helpers -----------------------------------------------------

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Substring match (case-insensitive as long as `text` is already lowercased)
function containsAny(text, words) {
  return words.some(word => text.includes(word));
}

// Whole-word/phrase match so e.g. "wann" doesn't match inside "wanna"
function containsWholeWord(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

async function safeReact(message, emoji, context = 'reaction') {
  try {
    await message.react(emoji);
  } catch (error) {
    console.error(`Failed to add ${context}:`, error);
  }
}

async function safeSend(message, content) {
  try {
    await message.channel.send(content);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

// Sends a countdown message, edits it down to 1, then deletes both messages.
async function countdownAndDelete(message, prefix, startAt = 5) {
  try {
    const countdownMsg = await message.channel.send(`${prefix}${startAt}...`);

    for (let i = startAt - 1; i >= 1; i--) {
      await delay(1000);
      await countdownMsg.edit(`${prefix}${i}...`);
    }

    await delay(1000);
    await message.delete();
    await countdownMsg.delete();
  } catch (error) {
    console.error('Failed to run countdown deletion:', error);
  }
}

function parseMinutesReminder(value) {
  const minutes = parseInt(value, 10);
  if (isNaN(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60000);
}

// Minutes to add to a UTC instant to get wall-clock time in `timeZone` (e.g. +120 for CEST).
function getTimeZoneOffsetMinutes(timeZone, utcDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(utcDate).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const asIfUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10)
  );

  return (asIfUtc - utcDate.getTime()) / 60000;
}

// Parses "DD.MM.YY HH:MM" as Europe/Berlin local time (CET or CEST, whichever
// applies on that date) and returns the equivalent UTC Date. Independent of
// the host machine's own timezone setting.
function parseGermanDateTime(value) {
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match;
  const fullYear = 2000 + parseInt(year, 10);

  // Guess the UTC instant by treating the wall-clock digits as if they were
  // UTC, then look up Berlin's real offset at that instant and correct for it.
  const guessUtcMs = Date.UTC(fullYear, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
  const offsetMinutes = getTimeZoneOffsetMinutes('Europe/Berlin', new Date(guessUtcMs));

  return new Date(guessUtcMs - offsetMinutes * 60000);
}

function resolveReminderTime(type, when) {
  if (type === 'time') return parseMinutesReminder(when);
  if (type === 'date') return parseGermanDateTime(when);
  return null;
}

// --- MongoDB -------------------------------------------------------------

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

const reminderSchema = new mongoose.Schema({
  userId: String,
  channelId: String,
  guildId: String,
  message: String,
  remindAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const Reminder = mongoose.model('Reminder', reminderSchema);

// Event: Bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register slash commands
  const commands = [
    {
      name: 'schedule',
      description: 'Shows the special events schedule',
    },
    {
      name: 'remind',
      description: 'Set a reminder',
      options: [
        {
          name: 'type',
          description: 'Time (in minutes) or Date (DD.MM. HH:MM)',
          type: 3, // STRING
          required: true,
          choices: [
            { name: 'time', value: 'time' },
            { name: 'date', value: 'date' }
          ]
        },
        {
          name: 'when',
          description: 'For time: minutes (e.g., 10). For date: DD.MM.YY HH:MM (e.g., 01.08.26 20:00)',
          type: 3, // STRING
          required: true
        },
        {
          name: 'message',
          description: 'What to remind you about',
          type: 3, // STRING
          required: true
        }
      ]
    },
    {
      name: 'remind-embed',
      description: 'Set a reminder with an embed',
    },
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('Slash commands registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }

  // Check for reminders every minute
  setInterval(checkReminders, 60000);
});

// Event: Message received
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const lowerContent = message.content.toLowerCase();

  const containsTargetWord = containsAny(lowerContent, targetWords);
  const containsKyleLarson = containsAny(lowerContent, larsonWords);
  const containsFrance = containsAny(lowerContent, franceWords);
  const containsMax = containsAny(lowerContent, maxWords);
  const containsLando = containsAny(lowerContent, landoWords);
  const containsTututu = containsAny(lowerContent, tutututuWords);
  const containsGrr = containsAny(lowerContent, grrWords);
  const contains1984 = containsAny(lowerContent, words1984);
  const containsGerman = containsAny(lowerContent, germanWords);
  const containsMogus = containsAny(lowerContent, mogusWords);
  const containsJob = containsAny(lowerContent, jobWords);

  // "wann rust" is more specific than a bare "wann"/"when" - only fire one response
  const containsWannRust = containsWholeWord(lowerContent, wannRustPhrase);
  const containsWann = !containsWannRust && wannWords.some(word => containsWholeWord(lowerContent, word));

  const containsDB = containsWholeWord(message.content, 'db');
  const isGrrrUser = message.author.id === grrrUserId;

  const textOnly = message.cleanContent
    .replace(/https?:\/\/\S+/gi, '') // Removes URLs (GIFs/Images)
    .replace(/<a?:\w+:\d+>/g, '');   // Removes Emoji IDs
  const contains67 = /6.*7|six.*seven|zes.*zeven|six.*sept|sechs.*sieben/i.test(textOnly);

  if (containsTargetWord) {
    await safeReact(message, '🤤');
  }

  if (contains67) {
    const randomLink = sixSevenGifLinks[Math.floor(Math.random() * sixSevenGifLinks.length)];
    await safeSend(message, randomLink);
  }

  if (containsMax) {
    try {
      await message.react('🤤');
      await delay(300); // Small delay between reactions
      await message.react('🇳🇱');
      await message.channel.send('TUTUTUTU');
    } catch (error) {
      console.error('Failed to react to Max mention:', error);
    }
  }

  if (containsLando) {
    try {
      await message.react('🤮');
      await delay(300); // Small delay between reactions
      await message.react('🌈');
    } catch (error) {
      console.error('Failed to react to Lando mention:', error);
    }
  }

  if (containsTututu) {
    await safeSend(message, 'MAX VERSTAPPEN');
  }

  if (containsGrr || isGrrrUser) {
    await safeReact(message, '1442859255748362261', 'custom emote');
  }

  if (contains1984) {
    await safeReact(message, '1478078827119902821', 'custom emote');
  }

  if (containsGerman || containsDB) {
    await safeReact(message, '1403499851739828356', 'German emote');
  }

  if (containsWann) {
    await safeSend(message, 'Jetzt!');
  }

  if (containsWannRust) {
    await safeSend(message, 'Nie!');
  }

  if (containsMogus) {
    await safeReact(message, '📮');
  }

  // Kyle Larson detection with countdown and deletion
  if (containsKyleLarson) {
    await countdownAndDelete(message, 'KYLE LARSON DETECTED! MESSAGE GETS DELETED IN ');
  }

  // France detection with countdown and deletion
  if (containsFrance) {
    await countdownAndDelete(message, 'FR*NCE DETECTED! PLEASE NEXT TIME CENSOR THE F WORD. MESSAGE DELETED IN ');
  }

  // Job detection with deletion
  if (containsJob) {
    try {
      await message.delete();
      await message.channel.send('J*B DETECTED!! PLEASE CENSOR IT AS IT MIGHT TRIGGER OTHER PEOPLE!!!');
    } catch (error) {
      console.error('Failed to delete job message:', error);
    }
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'schedule') {
      try {
        if (!fs.existsSync('./specialevents.webp')) {
          await interaction.reply('Schedule image not found!');
          return;
        }

        const attachment = new AttachmentBuilder('./specialevents.webp');
        await interaction.reply({ files: [attachment] });
      } catch (error) {
        console.error('Error sending schedule:', error);
        await interaction.reply('Failed to send schedule image!');
      }
    }

    if (interaction.commandName === 'remind') {
      try {
        const type = interaction.options.getString('type');
        const when = interaction.options.getString('when');
        const reminderMessage = interaction.options.getString('message');

        const remindAt = resolveReminderTime(type, when);
        if (!remindAt) {
          const errorText = type === 'time'
            ? 'Invalid time! Please enter a positive number of minutes.'
            : 'Invalid date format! Use: DD.MM.YY HH:MM (e.g., 01.08.26 20:00)';
          await interaction.reply(errorText);
          return;
        }

        if (remindAt < new Date()) {
          await interaction.reply('That date is in the past! Please choose a future date.');
          return;
        }

        const reminder = new Reminder({
          userId: interaction.user.id,
          channelId: interaction.channel.id,
          guildId: interaction.guild.id,
          message: reminderMessage,
          remindAt: remindAt
        });

        await reminder.save();

        const frankfurtTime = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
        await interaction.reply(`Reminder set! I'll remind you about "${reminderMessage}" at ${frankfurtTime} (Frankfurt time)`);
      } catch (error) {
        console.error('Error creating reminder:', error);
        await interaction.reply('Failed to create reminder!');
      }
    }

    if (interaction.commandName === 'remind-embed') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      const modal = new ModalBuilder()
        .setCustomId('reminder-modal')
        .setTitle('Set Embed Reminder');

      const typeInput = new TextInputBuilder()
        .setCustomId('reminder-type')
        .setLabel('Type: "time" or "date"')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('time or date')
        .setRequired(true);

      const whenInput = new TextInputBuilder()
        .setCustomId('reminder-when')
        .setLabel('When? (minutes OR DD.MM.YY HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10 OR 01.08.26 20:00')
        .setRequired(true);

      const embedInput = new TextInputBuilder()
        .setCustomId('reminder-embed')
        .setLabel('Embed JSON (from discohook.org)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('{"title":"Test","description":"Hello!"}')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(typeInput),
        new ActionRowBuilder().addComponents(whenInput),
        new ActionRowBuilder().addComponents(embedInput)
      );

      await interaction.showModal(modal);
    }
  }

  // Handle modal submissions
  if (interaction.isModalSubmit() && interaction.customId === 'reminder-modal') {
    try {
      const type = interaction.fields.getTextInputValue('reminder-type').toLowerCase();
      const when = interaction.fields.getTextInputValue('reminder-when');
      const embedJson = interaction.fields.getTextInputValue('reminder-embed');

      try {
        JSON.parse(embedJson);
      } catch (jsonError) {
        await interaction.reply({ content: 'Invalid JSON! Please use a valid embed JSON format.', ephemeral: true });
        return;
      }

      if (type !== 'time' && type !== 'date') {
        await interaction.reply({ content: 'Invalid type! Use "time" or "date".', ephemeral: true });
        return;
      }

      const remindAt = resolveReminderTime(type, when);
      if (!remindAt) {
        const errorText = type === 'time'
          ? 'Invalid time! Please enter a positive number of minutes.'
          : 'Invalid date format! Use: DD.MM.YY HH:MM (e.g., 01.08.26 20:00)';
        await interaction.reply({ content: errorText, ephemeral: true });
        return;
      }

      if (remindAt < new Date()) {
        await interaction.reply({ content: 'That date is in the past! Please choose a future date.', ephemeral: true });
        return;
      }

      // Save reminder with embed JSON
      const reminder = new Reminder({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        message: embedJson,
        remindAt: remindAt
      });

      await reminder.save();

      const frankfurtTime = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      await interaction.reply({ content: `Embed reminder set for ${frankfurtTime} (Frankfurt time)!`, ephemeral: true });
    } catch (error) {
      console.error('Error creating embed reminder:', error);
      await interaction.reply({ content: 'Failed to create reminder!', ephemeral: true });
    }
  }
});

// Check reminders function
async function checkReminders() {
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({ remindAt: { $lte: now } });

    for (const reminder of dueReminders) {
      try {
        const channel = await client.channels.fetch(reminder.channelId);
        if (channel) {
          if (reminder.message.trim().startsWith('{')) {
            try {
              const embedData = JSON.parse(reminder.message);
              const embed = new EmbedBuilder(embedData);
              await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
            } catch (jsonError) {
              // If JSON parsing fails, send as regular message
              await channel.send(`<@${reminder.userId}> Reminder: ${reminder.message}`);
            }
          } else {
            await channel.send(`<@${reminder.userId}> Reminder: ${reminder.message}`);
          }
        }
        await Reminder.deleteOne({ _id: reminder._id });
      } catch (error) {
        console.error('Error sending reminder:', error);
      }
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
