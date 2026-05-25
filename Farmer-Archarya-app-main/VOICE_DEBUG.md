# Voice Conversation Debugging Guide

## Problem

Voice button in the Ask section is not recording audio or returning responses from Farmer Acharya.

## Symptoms

- ✗ Voice button appears but doesn't respond to clicks
- ✗ Microphone permission prompt doesn't appear
- ✗ Recording doesn't start (no state change to "recording")
- ✗ No response audio is played back
- ✗ Browser console shows errors

## Root Causes Fixed

### 1. **Microphone Permission Errors**

**Before**: Microphone access denied errors were not user-friendly
**Fixed**: Added specific error messages for:

- `NotAllowedError` - "Please allow microphone access in your browser settings"
- `NotFoundError` - "No microphone found on this device"
- `NotReadableError` - "Microphone is already in use by another app"

### 2. **WebSocket Connection Issues**

**Before**: Socket errors showed generic messages
**Fixed**: Added close code interpretation:

- `1002` - Protocol error in voice session
- `1008` - Invalid message format
- `1011` - Server error in voice session

### 3. **Audio Encoding Validation**

**Before**: Audio data could fail silently during encoding/decoding
**Fixed**: Added validation for:

- Base64 data existence and length
- Audio buffer creation
- Sample count checks
- PCM to AudioBuffer conversion with error handling

### 4. **API Token Request Failures**

**Before**: Generic "Could not create Gemini Live token" message
**Fixed**: Added specific diagnostics for:

- `401/403` - Invalid API key
- `400` - Invalid request body
- `500` - Google server error

## Step-by-Step Debugging

### Step 1: Check Environment Variables

Verify `.env.local` has these set:

```
GEMINI_API_KEY=<your-key>
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
```

### Step 2: Open Browser DevTools

1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Filter logs for `[GeminiLive]` to see detailed debugging

### Step 3: Test Microphone Access

1. Click the voice button (microphone icon) in the Ask section
2. Check console for one of these messages:
   - `[GeminiLive] recording started` ✅ Success
   - `[GeminiLive] getUserMedia failed` ❌ Microphone issue
   - `[GeminiLive] socket error` ❌ Connection issue

### Step 4: Verify WebSocket Connection

Expected console log sequence:

```
[GeminiLive] requesting token { mode: 'ask', moduleId: '...', lang: '...' }
[GeminiLive] token received { model: 'gemini-3.1-flash-live-preview' }
[GeminiLive] socket open { model: '...' }
[GeminiLive] message received { isSetup: true }
```

### Step 5: Test Audio Recording

1. Start recording (hold voice button)
2. Speak a short sentence
3. Check console for:
   - Audio frames being sent (should see multiple messages)
   - `[GeminiLive] message received { inputText: true }` - Your speech transcribed

### Step 6: Verify Audio Response

When Farmer Acharya responds:

1. Check console for: `[GeminiLive] enqueueing audio chunk`
2. You should hear audio playing
3. Check console for: `[GeminiLive] audio playback started`

## Common Error Messages & Fixes

| Error                     | Cause                             | Fix                                                |
| ------------------------- | --------------------------------- | -------------------------------------------------- |
| "Please allow microphone" | Microphone permission denied      | Allow microphone in browser settings               |
| "No microphone found"     | Device has no audio input         | Use a device with microphone or attach USB headset |
| "Microphone in use"       | Another app is using mic          | Close other apps using microphone                  |
| "Voice connection failed" | Network issue or API token failed | Check internet, check API key                      |
| "Protocol error (1002)"   | Invalid audio format sent         | Ensure audio encoding is PCM 16kHz                 |
| "Invalid API key"         | GEMINI_API_KEY is wrong           | Verify key in .env.local and restart server        |

## Testing Checklist

- [ ] `.env.local` has `GEMINI_API_KEY`
- [ ] Development server running on localhost:3000 or 3001
- [ ] Browser console opens successfully (F12)
- [ ] Microphone permission prompt appears on first click
- [ ] Audio recording starts (state changes to "recording")
- [ ] Browser shows microphone indicator (red dot or icon)
- [ ] Speak a question and release button
- [ ] Your speech is transcribed (see in console and on screen)
- [ ] Audio response plays back (speaker icon or audio output)
- [ ] Message appears in chat history after voice turn completes

## Detailed Logs to Check

### Token Request

```javascript
// In browser console, type:
fetch("/api/gemini-live-token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "ask", moduleId: "M01", lang: "en" }),
})
  .then((r) => r.json())
  .then(console.log);
```

Should return: `{ token: '..', model: 'gemini-3.1-flash-live-preview', websocketUrl: '...', setup: {} }`

### Network Tab

1. Open DevTools → **Network** tab
2. Click voice button
3. Look for request: `gemini-live-token` (POST)
   - Status should be `200`
   - Response should have `token`, `model`, `websocketUrl`

### WebSocket Connection

1. Open DevTools → **Network** tab → **WS** filter
2. Look for WebSocket connection to `generativelanguage.googleapis.com`
   - Status should be `101` (established)
   - Should show messages being sent/received

## Performance Notes

- First token request: ~1-2 seconds (creates Gemini session)
- WebSocket connection: ~200-500ms
- Audio recording: Starts immediately
- Response time: 2-5 seconds (depends on Farmer Acharya's reply length)
- Audio playback: Real-time as chunks arrive

## Browser Compatibility

✅ Supported:

- Chrome/Edge 88+
- Firefox 79+
- Safari 14.1+

❌ Not supported:

- Internet Explorer
- Very old browser versions

## Next Steps if Still Not Working

1. **Check API Key** - Test in Google Cloud Console
2. **Check Network** - Use VPN if behind corporate proxy
3. **Check Permissions** - Ensure browser has microphone access
4. **Check Console** - Share full error log from F12 console
5. **Restart Server** - `npm run dev` in terminal

## Reference Links

- [Gemini Live API Docs](https://ai.google.dev/api/python/google/generativeai/GenerativeModel#generate_content_stream)
- [WebSocket Connection Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [AudioContext API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
