# League of Legends Discord Bot Setup

## What Was Added

Your Discord bot now has a `/demacia {summonername}` command that fetches daily ranked League of Legends stats from the official Riot API for players on the EUW server.

## Files Modified/Created

1. **lol.js** (NEW) - League of Legends API integration module
2. **app.js** - Added handler for `/demacia` command
3. **commands.js** - Registered the new command
4. **package.json** - Added `axios` dependency
5. **.env.sample** - Added `RIOT_API_KEY` requirement
6. **README.md** - Updated with LoL command documentation

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Get a Riot API Key
1. Visit https://developer.riotgames.com/
2. Sign in with your Riot account
3. Get your Development API key (valid for 24 hours) or apply for a Production key

### 3. Configure Environment Variables
Create a `.env` file in the root directory with:
```
APP_ID=your_discord_app_id
DISCORD_TOKEN=your_discord_bot_token
PUBLIC_KEY=your_discord_public_key
RIOT_API_KEY=your_riot_api_key
```

### 4. Register Commands
```bash
npm run register
```

### 5. Run the Bot
```bash
npm start
```

## Command Usage

### `/demacia {summonername}`

**Example:** `/demacia Faker`

**Output includes:**
- ✅ Win/Loss record for Solo/Duo queue (today only)
- ✅ Win/Loss record for Flex queue (today only)
- ✅ Overall K/D/A for the day
- ✅ Detailed match history showing:
  - Champion played
  - Queue type
  - Win/Loss result
  - Individual game K/D/A
  - Game duration

**Notes:**
- Only works for EUW server summoners
- Only shows games from today (resets at midnight)
- Only shows ranked games (Solo/Duo and Flex queues)
- If no ranked games played today, will show appropriate message

## API Rate Limits

**Development API Key:**
- 20 requests per second
- 100 requests per 2 minutes

**Production API Key:**
- Higher limits (requires application approval)

## Troubleshooting

### "Summoner not found"
- Check spelling of summoner name
- Ensure summoner is on EUW server
- Try using exact capitalization

### "Failed to fetch match IDs"
- Check if RIOT_API_KEY is valid
- Verify API key hasn't expired (dev keys expire after 24h)
- Check rate limits

### Command not appearing in Discord
- Run `npm run register` to register commands
- Wait a few minutes for Discord to sync
- Check bot permissions in server

## Technical Details

### Riot API Endpoints Used
- `/lol/summoner/v4/summoners/by-name/{summonerName}` - Get summoner data
- `/lol/match/v5/matches/by-puuid/{puuid}/ids` - Get match IDs
- `/lol/match/v5/matches/{matchId}` - Get match details

### Queue Types Tracked
- 420 - Ranked Solo/Duo
- 440 - Ranked Flex

### Time Zone
Stats are calculated from midnight (00:00) in your server's local time zone.
