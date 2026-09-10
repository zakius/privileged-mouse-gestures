import { registerRemoteHandler } from '../util/webext/remote.js'
import { getCommandList, getCommandFunction } from './commands.js'
import { MouseGestureListener } from './mouse-gesture.js'
import { CommandKey } from '../common/settings.js'
import { localSettings } from './settings.js'

let gestureMappings = new Map<string, CommandKey>()
localSettings.listen('gestureMappings', (m) => {
	gestureMappings = new Map(m)
})

let recordGesturePorts = new Set<browser.runtime.Port>()
browser.runtime.onConnect.addListener((port) => {
	recordGesturePorts.add(port)
	port.onDisconnect.addListener(() => {
		recordGesturePorts.delete(port)
	})
})

const mouseGestureListener = new MouseGestureListener()
mouseGestureListener.onGesture = (gesture, windowId) => {
	if (recordGesturePorts.size) {
		for (const port of recordGesturePorts) {
			port.postMessage({ code: gesture })
			port.disconnect()
		}
		recordGesturePorts.clear()
		return
	}

	const key = gestureMappings.get(gesture)
	if (!key) return
	getCommandFunction(key)(windowId)
}
mouseGestureListener.onGetStatus = (gesture) => {
	let status = gesture
	const key = gestureMappings.get(gesture)
	if (key) status += ': ' + (commandLabels.get(key) ?? key)
	return status
}

// Labels for browser and extension commands only exist in the chrome window, so
// keep the last fetched set around for the gesture status overlay.
let commandLabels = new Map<CommandKey, string>()
async function loadCommandList() {
	const sections = await getCommandList()
	commandLabels = new Map(
		sections.flatMap((s) => s.items.map((i) => [i.id, i.label] as const)),
	)
	return sections
}
void loadCommandList()

export class BackgroundRemote {
	async getCommandList() {
		return loadCommandList()
	}
}
registerRemoteHandler(new BackgroundRemote())
