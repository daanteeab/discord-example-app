import 'dotenv/config';
import axios from 'axios';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = 'euw1'; // EUW region
const REGIONAL_ROUTING = 'europe'; // For match data

// Queue types
const QUEUE_TYPES = {
  RANKED_SOLO: 420,
  RANKED_FLEX: 440
};

// Queue names for display
const QUEUE_NAMES = {
  0: 'Custom',
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Co-op vs AI Intro',
  840: 'Co-op vs AI Beginner',
  850: 'Co-op vs AI Intermediate',
  900: 'URF',
  1020: 'One For All',
  1300: 'Nexus Blitz',
  1400: 'Ultimate Spellbook',
  1700: 'Arena',
  1900: 'Pick URF'
};

/**
 * Get summoner data by Riot ID (gameName#tagLine)
 */
export async function getSummonerByRiotId(gameName, tagLine) {
  try {
    // Step 1: Get PUUID from Riot ID using Account API
    const accountUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const accountResponse = await axios.get(accountUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    const puuid = accountResponse.data.puuid;
    
    // Step 2: Get summoner data using PUUID
    const summonerUrl = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const summonerResponse = await axios.get(summonerUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    return {
      ...summonerResponse.data,
      gameName: accountResponse.data.gameName,
      tagLine: accountResponse.data.tagLine
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const data = error.response.data;
      
      console.error('Riot API Error:', status, statusText, data);
      
      if (status === 404) {
        throw new Error(`Riot ID "${gameName}#${tagLine}" not found`);
      } else if (status === 403) {
        throw new Error(`API Key invalid, expired, or lacks permissions (HTTP ${status}). Error: ${data?.status?.message || statusText}`);
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded (HTTP ${status}). Please try again later`);
      } else if (status === 401) {
        throw new Error(`Unauthorized - Invalid API Key (HTTP ${status})`);
      } else {
        throw new Error(`API Error: HTTP ${status} ${statusText}. ${data?.status?.message || ''}`);
      }
    }
    throw new Error(`Network error: ${error.message}`);
  }
}

/**
 * Get match IDs for a player
 */
export async function getMatchIds(puuid, count = 20) {
  try {
    const startTime = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000); // Start of today
    const url = `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      },
      params: {
        startTime: startTime,
        count: count
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      throw new Error(`Failed to fetch match IDs: HTTP ${status} ${error.response.statusText}`);
    }
    throw new Error(`Failed to fetch match IDs: ${error.message}`);
  }
}

/**
 * Get match details
 */
export async function getMatchDetails(matchId) {
  try {
    const url = `https://${REGIONAL_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      throw new Error(`Failed to fetch match details: HTTP ${status} ${error.response.statusText}`);
    }
    throw new Error(`Failed to fetch match details: ${error.message}`);
  }
}

/**
 * Calculate daily stats for a summoner
 */
export async function getDailyStats(riotId) {
  try {
    // Parse Riot ID (gameName#tagLine)
    let gameName, tagLine;
    if (riotId.includes('#')) {
      [gameName, tagLine] = riotId.split('#');
    } else {
      // Default to EUW if no tag provided
      gameName = riotId;
      tagLine = 'EUW';
    }

    // Get summoner data
    const summoner = await getSummonerByRiotId(gameName, tagLine);
    const puuid = summoner.puuid;
    const displayName = `${summoner.gameName}#${summoner.tagLine}`;

    // Get match IDs from today
    const matchIds = await getMatchIds(puuid);

    if (matchIds.length === 0) {
      return {
        summonerName: displayName,
        noGames: true
      };
    }

    // Fetch all match details
    const matches = await Promise.all(
      matchIds.map(matchId => getMatchDetails(matchId))
    );

    // Filter for ranked games (Solo/Duo and Flex)
    const rankedMatches = matches.filter(match => 
      match.info.queueId === QUEUE_TYPES.RANKED_SOLO || 
      match.info.queueId === QUEUE_TYPES.RANKED_FLEX
    );

    // Calculate stats
    let soloWins = 0;
    let soloLosses = 0;
    let flexWins = 0;
    let flexLosses = 0;
    const matchHistory = [];

    for (const match of rankedMatches) {
      const participant = match.info.participants.find(p => p.puuid === puuid);
      
      if (!participant) continue;

      const queueType = match.info.queueId === QUEUE_TYPES.RANKED_SOLO ? 'Solo/Duo' : 'Flex';
      const win = participant.win;
      const kills = participant.kills;
      const deaths = participant.deaths;
      const assists = participant.assists;
      const champion = participant.championName;
      const gameDuration = Math.floor(match.info.gameDuration / 60); // Convert to minutes

      // Count wins/losses
      if (match.info.queueId === QUEUE_TYPES.RANKED_SOLO) {
        if (win) soloWins++;
        else soloLosses++;
      } else {
        if (win) flexWins++;
        else flexLosses++;
      }

      // Add to match history
      matchHistory.push({
        queueType,
        champion,
        win,
        kills,
        deaths,
        assists,
        kda: deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2),
        gameDuration
      });
    }

    // Calculate total KDA
    const totalKills = matchHistory.reduce((sum, m) => sum + m.kills, 0);
    const totalDeaths = matchHistory.reduce((sum, m) => sum + m.deaths, 0);
    const totalAssists = matchHistory.reduce((sum, m) => sum + m.assists, 0);

    return {
      summonerName: displayName,
      soloWins,
      soloLosses,
      flexWins,
      flexLosses,
      totalKills,
      totalDeaths,
      totalAssists,
      overallKDA: totalDeaths === 0 ? 'Perfect' : ((totalKills + totalAssists) / totalDeaths).toFixed(2),
      matchHistory
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Format stats into a Discord-friendly message
 */
export function formatStatsMessage(stats) {
  if (stats.noGames) {
    return `**${stats.summonerName}** has not played any ranked games today.`;
  }

  let message = `📊 **Daily Stats for ${stats.summonerName}**\n\n`;
  
  // Win/Loss record
  message += `**Win/Loss Record:**\n`;
  if (stats.soloWins > 0 || stats.soloLosses > 0) {
    message += `🏆 Solo/Duo: ${stats.soloWins}W - ${stats.soloLosses}L\n`;
  }
  if (stats.flexWins > 0 || stats.flexLosses > 0) {
    message += `🏆 Flex: ${stats.flexWins}W - ${stats.flexLosses}L\n`;
  }
  
  // Overall KDA
  message += `\n**Overall K/D/A:** ${stats.totalKills}/${stats.totalDeaths}/${stats.totalAssists} (${stats.overallKDA})\n`;
  
  // Match history
  message += `\n**Match History:**\n`;
  stats.matchHistory.forEach((match, index) => {
    const result = match.win ? '✅ Win' : '❌ Loss';
    message += `${index + 1}. **${match.champion}** - ${match.queueType} - ${result}\n`;
    message += `   K/D/A: ${match.kills}/${match.deaths}/${match.assists} (${match.kda}) - ${match.gameDuration}min\n`;
  });

  return message;
}

/**
 * Get live game data for a summoner
 */
export async function getLiveGame(gameName, tagLine) {
  try {
    // Get summoner data first
    const summoner = await getSummonerByRiotId(gameName, tagLine);
    const summonerId = summoner.id;

    // Get active game
    const url = `https://${REGION}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${summonerId}`;
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    return {
      ...response.data,
      searchedSummoner: summoner
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 404) {
        throw new Error('Player is not currently in a game');
      } else if (status === 403) {
        throw new Error(`API Key issue (HTTP ${status})`);
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded. Try again later`);
      } else {
        throw new Error(`API Error: HTTP ${status}`);
      }
    }
    throw new Error(`Network error: ${error.message}`);
  }
}

/**
 * Get ranked stats for a summoner
 */
async function getRankedStats(summonerId) {
  try {
    const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      },
      timeout: 10000
    });

    const rankedData = {};
    for (const entry of response.data) {
      if (entry.queueType === 'RANKED_SOLO_5x5') {
        const winRate = Math.round((entry.wins / (entry.wins + entry.losses)) * 100);
        rankedData.solo = `${entry.tier} ${entry.rank} ${entry.leaguePoints}LP (${entry.wins}W ${entry.losses}L - ${winRate}%)`;
      } else if (entry.queueType === 'RANKED_FLEX_SR') {
        const winRate = Math.round((entry.wins / (entry.wins + entry.losses)) * 100);
        rankedData.flex = `${entry.tier} ${entry.rank} ${entry.leaguePoints}LP (${entry.wins}W ${entry.losses}L - ${winRate}%)`;
      }
    }
    return rankedData;
  } catch (error) {
    return { solo: 'Unranked', flex: 'Unranked' };
  }
}

/**
 * Format live game into a Discord-friendly message
 */
export async function formatLiveGameMessage(gameData) {
  const queueName = QUEUE_NAMES[gameData.gameQueueConfigId] || `Queue ${gameData.gameQueueConfigId}`;
  const gameDuration = Math.floor(gameData.gameLength / 60);
  const gameSeconds = gameData.gameLength % 60;
  
  let message = `🎮 **LIVE GAME** - ${queueName}\n`;
  message += `⏱️ Game Duration: ${gameDuration}:${String(gameSeconds).padStart(2, '0')}\n`;
  message += `📍 Map: ${gameData.mapId === 11 ? "Summoner's Rift" : `Map ${gameData.mapId}`}\n\n`;

  // Separate teams
  const team100 = gameData.participants.filter(p => p.teamId === 100);
  const team200 = gameData.participants.filter(p => p.teamId === 200);

  // Function to format team
  const formatTeam = async (team, teamName, color) => {
    let teamMsg = `${color} **${teamName}**\n`;
    
    for (const player of team) {
      const isSearched = player.summonerId === gameData.searchedSummoner.id;
      const prefix = isSearched ? '➤ ' : '   ';
      
      // Get rank info
      const rankInfo = await getRankedStats(player.summonerId);
      const rank = rankInfo.solo || rankInfo.flex || 'Unranked';
      
      // Get summoner spells
      const spell1 = player.spell1Id;
      const spell2 = player.spell2Id;
      
      teamMsg += `${prefix}**${player.championName}** - ${player.riotId || player.summonerName}\n`;
      teamMsg += `${prefix}   ${rank}\n`;
      
      // Show if they're on a win/loss streak (if we have recent data)
      if (player.perks) {
        const runeStyle = player.perks.perkStyle;
        teamMsg += `${prefix}   Runes: Primary ${runeStyle}\n`;
      }
    }
    
    return teamMsg + '\n';
  };

  // Format both teams
  message += await formatTeam(team100, 'Blue Side', '🔵');
  message += await formatTeam(team200, 'Red Side', '🔴');

  // Add ban information if available
  if (gameData.bannedChampions && gameData.bannedChampions.length > 0) {
    const team100Bans = gameData.bannedChampions.filter(b => b.teamId === 100 && b.championId !== -1).length;
    const team200Bans = gameData.bannedChampions.filter(b => b.teamId === 200 && b.championId !== -1).length;
    
    if (team100Bans > 0 || team200Bans > 0) {
      message += `🚫 **Bans:** Blue (${team100Bans}) | Red (${team200Bans})\n`;
    }
  }

  message += `\n💡 *Note: Real-time K/D/A data not available via API. Showing rank stats.*`;

  return message;
}

