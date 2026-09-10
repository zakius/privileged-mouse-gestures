import { Settings } from '../common/settings.js'
import { LocalSettings } from '../util/webext/settings.js'

// LocalSettings owns a single storage.onChanged listener, so a second copy in
// another page would silently double every settings update.
if (
	new URL(
		(browser.runtime.getManifest() as any).background.page!,
		location.href,
	).pathname !== location.pathname
)
	throw new Error('background/settings.js loaded outside the background page')

export const localSettings = new LocalSettings(new Settings())
export const S = localSettings.data
