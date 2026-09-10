import { RemoteSettings } from '../util/webext/settings.js'

// Either a key from _locales (a command this extension implements itself) or an
// id from browser.browserCommands.getAll().
export type CommandKey = string
export type BuiltinCommandKey = keyof I18nMessages

export class Settings {
	mouseGestureButton: 'left' | 'middle' | 'right' = 'right'
	displayTrace = true
	traceColor = '#0652ff'
	traceColorAlpha = 80
	traceWidth = 3
	displayStatus = true
	statusFont = '24pt monospace'
	statusTextColor = '#000000'
	statusTextColorAlpha = 90
	statusBackgroundColor = '#ffffe4'
	statusBackgroundColorAlpha = 90
	statusBorderColor = '#b7c9e2'
	statusBorderColorAlpha = 90
	statusPositionX = 50
	statusPositionY = 90
	gestureDirections: 'RDLU' | 'RRdDLdLLuURu' = 'RDLU'
	wheelGestures = true
	rockerGestures = true

	gestureMappings: [string, CommandKey][] = [
		['UR', 'cmd_newNavigatorTab'],
		['DR', 'closeTab'],
		['L', 'Browser:BackOrBackDuplicate'],
		['R', 'Browser:ForwardOrForwardDuplicate'],
		['DU', 'upperLevel'],
		['U', 'scrollUp'],
		['D', 'scrollDown'],
		['RU', 'scrollToTop'],
		['RD', 'scrollToBottom'],
		['WheelU', 'Browser:PrevTab'],
		['WheelD', 'Browser:NextTab'],
	]

	// hidden
	distanceThreshold = 10
	distanceStep = 10
}

export const remoteSettings = new RemoteSettings(new Settings())
