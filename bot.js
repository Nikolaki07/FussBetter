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

// Words to detect (case-insensitive)
const targetWords = ['füssen', 'fuss', 'fuß', 'foot', 'voeten', 'voet'];
const larsonWords = ['kyle larson', 'larson'];
const franceWords = ['france', '🇫🇷', 'french'];
const maxWords = ['max', 'max verstappen', 'verstappen', 'maximilian', 'maggs'];
const landoWords = ['lando', 'norris', 'lando norris', 'lando no rizz'];
const tutututuWords = ['tututu', 'tödödö'];
const grrWords = ['törken', 'franzosen', 'nederlanders', 'niederländer'];
const germanWords = ['duits', 'deutsch', 'deutschland', 'german', 'duitsers', 'arier'];
const wannCsWords = ['wann cs'];

// User ID to react to with grrr emoji
const grrrUserId = '629336494015905792';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Reminder Schema
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

  // Convert message to lowercase for case-insensitive comparison
  const lowerContent = message.content.toLowerCase();

  // Check if message contains any target words
  const containsTargetWord = targetWords.some(word => 
    lowerContent.includes(word)
  );

  // Check if message contains Kyle Larson
  const containsKyleLarson = larsonWords.some(word => 
    lowerContent.includes(word)
  );

  // Check if message contains France
  const containsFrance = franceWords.some(word => 
    lowerContent.includes(word)
  );

  const containsMax = maxWords.some(word =>
    lowerContent.includes(word)
  );

  const containsLando = landoWords.some(word =>
    lowerContent.includes(word)
  );

  const containsTututu = tutututuWords.some(word =>
    lowerContent.includes(word)
  );

  const containsGrr = grrWords.some(word =>
    lowerContent.includes(word)
  );

  const containsGerman = germanWords.some(word =>
    lowerContent.includes(word)
  );
  
  // Special check for "db" - must be standalone word
  const containsDB = /\bdb\b/i.test(message.content);
  
  const containsCS = wannCsWords.some(word => 
    lowerContent.includes(word)
  );

  // Check if message is from specific user
  const isGrrrUser = message.author.id === grrrUserId;

  // Add reaction if target word found
  if (containsTargetWord) {
    try {
      await message.react('🤤');
    } catch (error) {
      console.error('Failed to react:', error);
    }
  }

  if (containsMax) {
    try {
      await message.react('🤤');
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between reactions
      await message.react('🇳🇱');
      await message.channel.send('TUTUTUTU');
    } catch (error) {
      console.error('Failed to react:', error);
    }
  }

  if (containsLando) {
    try {
      await message.react('🤮');
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between reactions
      await message.react('🌈');
    } catch (error) {
      console.error('Failed to react:', error);
    }
  }

  if (containsTututu) {
    try {
      await message.channel.send('MAX VERSTAPPEN');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  if (containsGrr || isGrrrUser) {
    try {
      await message.react('1442859255748362261');
    } catch (error) {
      console.error('Failed to react with custom emote:', error);
    }
  }

  if (containsGerman || containsDB) {
    try {
      await message.react('1403499851739828356');
    } catch (error) {
      console.error('Failed to react with German emote:', error);
    }
  }
  
  if (containsCS) {
    try {
      await message.channel.send('Jetzt!');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  // Kyle Larson detection with countdown and deletion
  if (containsKyleLarson) {
    try {
      // Send the countdown message
      const countdownMsg = await message.channel.send('KYLE LARSON DETECTED! MESSAGE GETS DELETED IN 5...');

      // Countdown from 5 to 1
      for (let i = 4; i >= 1; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        await countdownMsg.edit(`KYLE LARSON DETECTED! MESSAGE GETS DELETED IN ${i}...`);
      }

      // Wait 1 more second before deleting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Delete both messages
      await message.delete();
      await countdownMsg.delete();
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  }

  // France detection with countdown and deletion
  if (containsFrance) {
    try {
      // Send the countdown message
      const countdownMsg = await message.channel.send('FR*NCE DETECTED! PLEASE NEXT TIME CENSOR THE F WORD. MESSAGE DELETED IN 5...');

      // Countdown from 5 to 1
      for (let i = 4; i >= 1; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        await countdownMsg.edit(`FR*NCE DETECTED! PLEASE NEXT TIME CENSOR THE F WORD. MESSAGE DELETED IN ${i}...`);
      }

      // Wait 1 more second before deleting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Delete both messages
      await message.delete();
      await countdownMsg.delete();
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'schedule') {
      try {
        // Check if the image file exists
        if (!fs.existsSync('./specialevents.webp')) {
          await interaction.reply('Schedule image not found!');
          return;
        }

        // Create attachment and send
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
        const message = interaction.options.getString('message');
        
        let remindAt;
        
        if (type === 'time') {
          // Parse minutes
          const minutes = parseInt(when);
          if (isNaN(minutes) || minutes <= 0) {
            await interaction.reply('Invalid time! Please enter a positive number of minutes.');
            return;
          }
          remindAt = new Date(Date.now() + minutes * 60000);
        } else if (type === 'date') {
          // Parse date format: DD.MM.YY HH:MM
          const match = when.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
          if (!match) {
            await interaction.reply('Invalid date format! Use: DD.MM.YY HH:MM (e.g., 01.08.26 20:00)');
            return;
          }
          
          const [, day, month, year, hour, minute] = match;
          const fullYear = 2000 + parseInt(year);
          
          // Create date in CET timezone
          // We interpret the input as CET/CEST and convert to UTC
          const localDate = new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
          
          // Get CET offset (CET is UTC+1, CEST is UTC+2)
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Berlin',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
          // Create a date object that represents the user's input in CET
          const cetString = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
          
          // Parse as local time and get the offset
          const tempDate = new Date(cetString);
          const cetDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
          const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
          const offsetMinutes = (utcDate - cetDate) / 60000;
          
          remindAt = new Date(tempDate.getTime() - offsetMinutes * 60000);
          
          // Check if date is in the past
          if (remindAt < new Date()) {
            await interaction.reply('That date is in the past! Please choose a future date.');
            return;
          }
        }
        
        // Save reminder to database
        const reminder = new Reminder({
          userId: interaction.user.id,
          channelId: interaction.channel.id,
          guildId: interaction.guild.id,
          message: message,
          remindAt: remindAt
        });
        
        await reminder.save();
        
        const frankfurtTime = remindAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
        await interaction.reply(`Reminder set! I'll remind you about "${message}" at ${frankfurtTime} (Frankfurt time)`);
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

      // Validate JSON
      let embedData;
      try {
        embedData = JSON.parse(embedJson);
      } catch (jsonError) {
        await interaction.reply({ content: 'Invalid JSON! Please use a valid embed JSON format.', ephemeral: true });
        return;
      }

      let remindAt;

      if (type === 'time') {
        const minutes = parseInt(when);
        if (isNaN(minutes) || minutes <= 0) {
          await interaction.reply({ content: 'Invalid time! Please enter a positive number of minutes.', ephemeral: true });
          return;
        }
        remindAt = new Date(Date.now() + minutes * 60000);
      } else if (type === 'date') {
        const match = when.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2})$/);
        if (!match) {
          await interaction.reply({ content: 'Invalid date format! Use: DD.MM.YY HH:MM (e.g., 01.08.26 20:00)', ephemeral: true });
          return;
        }

        const [, day, month, year, hour, minute] = match;
        const fullYear = 2000 + parseInt(year);
        const dateString = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
        remindAt = new Date(dateString + '+01:00');
        
        const frankfurtDate = new Date(remindAt.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const offset = (remindAt - frankfurtDate) / 60000;
        remindAt = new Date(remindAt.getTime() - offset * 60000);

        if (remindAt < new Date()) {
          await interaction.reply({ content: 'That date is in the past! Please choose a future date.', ephemeral: true });
          return;
        }
      } else {
        await interaction.reply({ content: 'Invalid type! Use "time" or "date".', ephemeral: true });
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
          // Check if message is JSON (embed)
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
            // Regular text message
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