# Chess Timer Alert

Firefox extension that plays configurable low-time warnings on Chess.com and Lichess. Version 1.3.1 starts repeated sounds 100 ms apart, allowing them to overlap. Version 1.3.0 added saved, editable presets to the Quiet Mint popup. The extension requires no background service or runtime dependencies.

The light Quiet Mint interface uses locally bundled Google Material Symbols Outlined icons (Apache 2.0; see `popup/fonts/`). No icon is drawn specifically for the popup, and Google Fonts is not contacted at runtime. **Clock & player** opens a separate settings view; Back and Escape preserve unsaved changes, while **Save changes** applies all fields. The master switch also requires saving. An empty state, save feedback and clock status make the current configuration visible.

The popup stays at 390 × 600 px across all views, including preset saves and errors. Longer content scrolls inside the popup; the header and action buttons stay visible.

## Try the upgrade

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select this repository's `manifest.json`. Reload existing game tabs once after installing/updating the extension. Later settings changes apply without reloading.

Open the popup, choose a saved preset from the dropdown (initially **30 / 15 / 5 s** and **30 / 10 / 5 s**) or add your own thresholds, and press **Save changes**. Thresholds are seconds (0.5–86400, in steps of 0.5); each plays 1–10 sounds. **Clear** disables alerts and clears the active configuration, preserving saved presets. Editing fields and the enabled checkbox takes effect when saved.

## Saved presets

Create an alert list, then choose **Save current as new preset...** in the preset dropdown. Enter a name and choose **Save preset**. To edit an existing preset, select it and use the pencil button next to the dropdown. The editor supports renaming, changing times and sound counts, adding/removing alerts and deleting the preset. Back or Escape cancels editing without changing the main alert list.

Saving a preset stores a reusable list; choosing **Save changes** on the main screen applies that list to games. Presets contain times and sound counts, while clock selection, username and rearming remain separate settings. Preset names must be unique, with 1–60 characters. Up to 50 presets, each with up to 50 alerts, are supported. Presets persist locally across popup/browser restarts; they are not synced between devices. Defaults appear only when no library has ever been saved, so deleting all presets does not bring them back.

Automatic selection matches the signed-in username against the players. If it cannot identify you, enter your username in the popup. This override is shared between sites: clear or change it if your usernames differ. Anonymous players can explicitly select **White** or **Black**; manual selection also tracks that color in watched games and must be updated when changing sides. Automatic matching follows board flips and stays silent when your username is not a participant.

Use **Test sound** to verify popup audio. The game tab has its own playback permissions, so also allow audio there if the game status reports a playback error. The popup displays the current tab's clock status.

## Alarm rules

- Alerts fire only while the selected clock is running and has positive time.
- First detection below several thresholds consumes all reached thresholds and plays only the lowest one's series. Repeated sounds start 100 ms apart and may overlap; a more urgent alarm replaces the previous series.
- With rearming enabled, a threshold becomes available again only after the selected time rises above it, including after an increment. Otherwise it plays once per detected game.
- A new URL/game ID, changed player/color identity, observed end followed by a new active game, or a reset move list accompanied by both clocks rising resets the game state. Flipping the board keeps the state.
- Finishing a game, losing the selected clock, disabling alerts, clearing settings, or moving to the opponent's turn cancels pending audio.
- Invalid settings stop monitoring and display an error. Invalid clock text is never interpreted as low time. Hours, tenths and hundredths are supported; localized verbal accessibility clocks are currently reported as unsupported.
- The document is observed for clock changes, with a 250 ms fallback. Background tab throttling or suspension can delay detection; the extension does not promise exact subsecond warnings.

## Settings and files

`core.js` contains validation, clock parsing, the threshold engine and game-session state. `sites.js` reads each site's DOM; `content.js` coordinates observation and audio. `settings.js` is shared by the content script and popup.

Settings are stored atomically as `chessAlertSettings` in Firefox sync storage, backed up locally. Legacy `alertSettings` and `resetAlertOnTimeIncrease` are read until a new configuration is saved. An explicit empty configuration takes precedence over legacy data. Failed sync writes show an error; failed backup writes show a warning. No remote fonts, analytics or network services are used by the extension.

The preset library is stored separately as `chessAlertPresets` in `storage.local`, avoiding sync's per-item quota and preventing preset-only edits from restarting active alarms. Invalid libraries and failed writes show errors without overwriting the saved data.

Site integration relies on DOM classes, player links, running-clock markers and results. Lichess selectors were checked against its [clock view](https://github.com/lichess-org/lila/blob/master/ui/lib/src/game/clock/clockView.ts), [player view](https://github.com/lichess-org/lila/blob/master/ui/round/src/view/user.ts) and [replay view](https://github.com/lichess-org/lila/blob/master/ui/round/src/view/replay.ts). Chess.com may change its classes independently; the popup reports missing clocks or unknown player identity instead of choosing the bottom clock blindly.

## Checks and packaging

Use Node.js 22 or newer:

```text
npm test
npm run check
```

Tests cover validation, parsing, thresholds, rearming, settings migration, controller lifecycle, audio failure handling, and representative site DOM fixtures. Browser tests use an installed Chrome/Chromium and Firefox (override paths with `CHROME_PATH` and `FIREFOX_PATH`); unavailable browsers are reported as skipped. Firefox also exercises the real popup with mocked extension APIs, checks the bundled icon font and verifies that both standard Quiet Mint views fit in 390 × 600 px. Local preview screenshots are saved to `dist/previews/`. Longer feedback messages and large lists can require scrolling. Browser fixtures are local examples, not captured current-site snapshots or complete installed-extension tests.

To regenerate CSS, install/use Dart Sass and run `npm run build:css`. On Windows with blocked PowerShell npm shims use `npm.cmd` and `sass.cmd`.

On Windows, run `npm.cmd run package` to produce `dist/chess-timer-alert-1.3.1.zip` using `scripts/package.ps1`. The package contains only extension runtime files and the icon font with its license; it does not overwrite the existing root ZIP/XPI. It is unsigned and must be signed through Mozilla for normal Firefox distribution.

## Live Firefox release checklist

Before publishing, verify both sites in a signed-in Firefox session:

- Apply settings during a game, then clear and re-enable them without reloading.
- Play both colors, flip the board, and enable the site's white-at-bottom option.
- Check short clocks, an increment crossing a threshold, and a long clock with hours.
- Finish and rematch, including navigation without a document reload.
- Watch someone else's game: automatic mode stays silent; manual color is explicit.
- Check a background tab, blocked site audio, and recovery after granting playback permission.

Authenticated live games and Firefox extension signing are not covered by the automated fixtures.
