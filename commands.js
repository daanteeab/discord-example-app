import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// League of Legends stats command
const DEMACIA_COMMAND = {
  name: 'demacia',
  description: 'League of Legends game statistics and info',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'stats',
      description: 'Get daily ranked stats (use Riot ID: gameName#tagLine)',
      options: [
        {
          type: 3,
          name: 'riotid',
          description: 'Riot ID (e.g., PlayerName#EUW or PlayerName#1234)',
          required: true,
        },
      ],
    },
    {
      type: 1, // SUB_COMMAND
      name: 'live',
      description: 'Check if a player is currently in a game',
      options: [
        {
          type: 3,
          name: 'riotid',
          description: 'Riot ID (e.g., PlayerName#EUW or PlayerName#1234)',
          required: true,
        },
      ],
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, DEMACIA_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
