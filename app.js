import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { getDailyStats, formatStatsMessage, getLiveGame, formatLiveGameMessage } from './lol.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "demacia" command - League of Legends stats and live game
    if (name === 'demacia') {
      const subcommand = data.options[0].name;
      const riotId = data.options[0].options[0].value;
      
      // Handle stats subcommand
      if (subcommand === 'stats') {
        // Fetch stats asynchronously and send response
        (async () => {
          try {
            const stats = await getDailyStats(riotId);
            const message = formatStatsMessage(stats);

            // Send follow-up message with stats
            await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}`, {
              method: 'POST',
              body: {
                content: message,
              },
            });
          } catch (error) {
            console.error('Error fetching League stats:', error);
            
            // Format detailed error message
            let errorMessage = `❌ **Error fetching stats for "${riotId}"**\n\n`;
            errorMessage += `**Details:** ${error.message}\n\n`;
            
            // Add helpful hints based on error type
            if (error.message.includes('not found')) {
              errorMessage += `💡 Make sure to use Riot ID format: **gameName#tagLine** (e.g., PlayerName#EUW)`;
            } else if (error.message.includes('API Key') || error.message.includes('403') || error.message.includes('401')) {
              errorMessage += `💡 Check your RIOT_API_KEY in the .env file. Development keys expire after 24 hours.`;
            } else if (error.message.includes('429')) {
              errorMessage += `💡 You've hit the rate limit. Wait a minute and try again.`;
            } else if (error.message.includes('Network')) {
              errorMessage += `💡 Check your internet connection or try again later.`;
            }
            
            try {
              await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}`, {
                method: 'POST',
                body: {
                  content: errorMessage,
                },
              });
            } catch (webhookError) {
              console.error('Failed to send error message:', webhookError);
            }
          }
        })();
      }
      
      // Handle live subcommand
      if (subcommand === 'live') {
        // Fetch live game asynchronously
        (async () => {
          try {
            // Parse Riot ID
            let gameName, tagLine;
            if (riotId.includes('#')) {
              [gameName, tagLine] = riotId.split('#');
            } else {
              gameName = riotId;
              tagLine = 'EUW';
            }

            const gameData = await getLiveGame(gameName, tagLine);
            const message = await formatLiveGameMessage(gameData);

            // Send follow-up message with live game info
            await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}`, {
              method: 'POST',
              body: {
                content: message,
              },
            });
          } catch (error) {
            console.error('Error fetching live game:', error);
            
            // Format error message
            let errorMessage = `❌ **Error checking live game for "${riotId}"**\n\n`;
            errorMessage += `**Details:** ${error.message}\n\n`;
            
            // Add helpful hints
            if (error.message.includes('not currently in a game')) {
              errorMessage += `💡 The player is not in an active game right now.`;
            } else if (error.message.includes('not found')) {
              errorMessage += `💡 Make sure to use Riot ID format: **gameName#tagLine**`;
            }
            
            try {
              await DiscordRequest(`webhooks/${process.env.APP_ID}/${req.body.token}`, {
                method: 'POST',
                body: {
                  content: errorMessage,
                },
              });
            } catch (webhookError) {
              console.error('Failed to send error message:', webhookError);
            }
          }
        })();
      }

      // Send deferred response immediately
      return res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
