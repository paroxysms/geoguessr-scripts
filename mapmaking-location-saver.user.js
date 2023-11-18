// ==UserScript==
// @name         map-making.app Location Saver
// @description  Save locations to Map Making App
// @version      1.0
// @author       miraclewhips (and alphaary I guess)
// @match        *://*.geoguessr.com/*
// @run-at       document-start
// @require      https://miraclewhips.dev/geoguessr-event-framework/geoguessr-event-framework.min.js?v=5
// @icon         https://www.google.com/s2/favicons?domain=geoguessr.com
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_openInTab
// @copyright    2022, miraclewhips (https://github.com/miraclewhips)
// @license      MIT
// @downloadURL  https://github.com/miraclewhips/geoguessr-userscripts/raw/master/geoguessr-training-mode.user.js
// @updateURL    https://github.com/miraclewhips/geoguessr-userscripts/raw/master/geoguessr-training-mode.user.js
// ==/UserScript==


/* ----- API KEY INSTRUCTIONS -----

Requires an API key from Map Making App in order to save locations.
Create one here: https://map-making.app/keys
Make sure not to share this key with anybody or show it publically as it will allow anybody to edit your maps.

Replace `PASTE_YOUR_KEY_HERE` with your generated API key (make sure not to delete the quotes surrounding the key) */
const MAP_MAKING_API_KEY = "PASTE_YOUR_KEY_HERE";

/* ############################################################################### */
/* ##### DON'T MODIFY ANYTHING BELOW HERE UNLESS YOU KNOW WHAT YOU ARE DOING ##### */
/* ############################################################################### */

GM_addStyle(`
.mwgtm-modal {
	position: fixed;
	inset: 0;
	z-index: 99999;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
}

.mwgtm-modal .dim {
	position: fixed;
	inset: 0;
	z-index: 0;
	background: rgba(0,0,0,0.75);
}

.mwgtm-modal .text {
	position: relative;
	z-index: 1;
}

.mwgtm-modal .inner {
	box-sizing: border-box;
	position: relative;
	z-index: 1;
	background: #fff;
	padding: 20px;
	margin: 20px;
	width: calc(100% - 40px);
	max-width: 500px;
	overflow: auto;
	color: #000;
	flex: 0 1 auto;
}

#mwgtm-loader {
	color: #fff;
	font-weight: bold;
}

.mwgtm-settings {
	position: absolute;
	top: 1rem;
	left: 1rem;
	z-index: 9;
	display: flex;
	flex-direction: column;
	gap: 5px;
	align-items: flex-start;
}

.mwgtm-settings-option {
	background: var(--ds-color-purple-100);
	padding: 6px 10px;
	border-radius: 5px;
	font-size: 12px;
	cursor: pointer;
	opacity: 0.75;
	transition: opacity 0.2s;
}

.mwgtm-settings-option:hover {
	opacity: 1;
}

#mwgtm-map-list h3 {
	margin-bottom: 10px;
}

#mwgtm-map-list .tag-input {
	display: block;
	width: 100%;
	font: inherit;
}

#mwgtm-map-list .maps {
	max-height: 200px;
	overflow-x: hidden;
	overflow-y: auto;
	font-size: 15px;
}

#mwgtm-map-list .map {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 20px;
	padding: 8px;
	transition: background 0.2s;
}

#mwgtm-map-list .map:nth-child(2n) {
	background: #f0f0f0;
}

#mwgtm-map-list .map-buttons:not(.is-added) .map-added {
	display: none !important;
}
#mwgtm-map-list .map-buttons.is-added .map-add {
	display: none !important;
}

#mwgtm-map-list .map-add {
	background: var(--ds-color-green-80);
	color: #fff;
	padding: 3px 6px;
	border-radius: 5px;
	font-size: 13px;
	font-weight: bold;
	cursor: pointer;
}

#mwgtm-map-list .map-added {
	background: #000;
	color: #fff;
	padding: 3px 6px;
	border-radius: 5px;
	font-size: 13px;
	font-weight: bold;
}
`);

function defaultState() {
	return {
		recentMaps: []
	}
}

function loadState() {
	let data = window.localStorage.getItem('mwgtm_state');
	if(!data) return;

	let dataJson = JSON.parse(data);
	if(!data) return;

	Object.assign(MWGTM_STATE, defaultState(), dataJson);
	saveState();
}

function saveState() {
	window.localStorage.setItem('mwgtm_state', JSON.stringify(MWGTM_STATE));
}

var MWGTM_STATE = defaultState();
loadState();

async function mmaFetch(url, options = {}) {
	const response = await fetch(new URL(url, 'https://map-making.app'), {
		...options,
		headers: {
			accept: 'application/json',
			authorization: `API ${MAP_MAKING_API_KEY.trim()}`,
			...options.headers
		}
	});
	if (!response.ok) {
		let message = 'Unknown error';
		try {
			const res = await response.json();
			if (res.message) {
				message = res.message;
			}
		} catch {
		}
		alert(`An error occurred while trying to connect to Map Making App. ${message}`);
		throw Object.assign(new Error(message), { response });
	}
	return response;
}
async function getMaps() {
	const response = await mmaFetch(`/api/maps`);
	const maps = await response.json();
	return maps;
}
async function importLocations(mapId, locations) {
	const response = await mmaFetch(`/api/maps/${mapId}/locations`, {
		method: 'post',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			edits: [{
				action: { type: 4 },
				create: locations,
				remove: []
			}]
		})
	});
	await response.json();
}

var LOCATION;
var MAP_LIST;

if(!GeoGuessrEventFramework) {
	throw new Error('GeoGuessr Location Manager requires GeoGuessr Event Framework (https://github.com/miraclewhips/geoguessr-event-framework). Please include this before you include GeoGuessr Location Manager.');
}

function showLoader() {
	if(document.getElementById('mwgtm-loader')) return;

	const element = document.createElement('div');
	element.id = 'mwgtm-loader';
	element.className = 'mwgtm-modal';
	element.innerHTML = `
		<div class="text">LOADING...</div>
		<div class="dim"></div>
	`;
	document.body.appendChild(element);
}

function hideLoader() {
	const element = document.getElementById('mwgtm-loader');
	if(element) element.remove();
}

async function clickedMapButton(e) {
	if(MAP_MAKING_API_KEY === 'PASTE_YOUR_KEY_HERE') {
		alert('An API Key is required in order to save locations to Map Making App. Please add your API key by editing the Userscript and following the instructions at the top of the script.');
		return;
	}

	if(!MAP_LIST) {
		showLoader();

		try {
			MAP_LIST = await getMaps();
		}catch{}

		hideLoader();
	}

	if(MAP_LIST) {
		showMapList()
	}
}

function showMapList() {
	if(document.getElementById('mwgtm-map-list')) return;

	const element = document.createElement('div');
	element.id = 'mwgtm-map-list';
	element.className = 'mwgtm-modal';

	let recentMapsSection = ``;
	if(MWGTM_STATE.recentMaps.length > 0) {
		let recentMapsHTML = '';
		for(let m of MWGTM_STATE.recentMaps) {
			if(m.archivedAt) continue;
			recentMapsHTML += `<div class="map">
				<span class="map-name">${m.name}</span>
				<span class="map-buttons">
					<span class="map-add" data-id="${m.id}">ADD</span>
					<span class="map-added">ADDED</span>
				</span>
			</div>`;
		}

		recentMapsSection = `
			<h3>Recent Maps</h3>

			<div class="maps">
				${recentMapsHTML}
			</div>

			<br>
		`;
	}

	let mapsHTML = '';
	for(let m of MAP_LIST) {
		if(m.archivedAt) continue;
		mapsHTML += `<div class="map">
			<span class="map-name">${m.name}</span>
			<span class="map-buttons">
				<span class="map-add" data-id="${m.id}">ADD</span>
				<span class="map-added">ADDED</span>
			</span>
		</div>`;
	}

	element.innerHTML = `
		<div class="inner">
			<h3>Tags (comma separated)</h3>

			<input type="text" class="tag-input" id="mwgtm-map-tags" />

			<br><br>

			${recentMapsSection}

			<h3>All Maps</h3>

			<div class="maps">
				${mapsHTML}
			</div>
		</div>

		<div class="dim"></div>
	`;

	document.body.appendChild(element);

	element.querySelector('.dim').addEventListener('click', closeMapList);

	document.getElementById('mwgtm-map-tags').addEventListener('keyup', e => e.stopPropagation());
	document.getElementById('mwgtm-map-tags').addEventListener('keydown', e => e.stopPropagation());
	document.getElementById('mwgtm-map-tags').addEventListener('keypress', e => e.stopPropagation());
	document.getElementById('mwgtm-map-tags').focus();

	for(let map of element.querySelectorAll('.maps .map-add')) {
		map.addEventListener('click', addLocationToMap);
	}
}

function closeMapList(e) {
	const element = document.getElementById('mwgtm-map-list');
	if(element) element.remove();
}

function addLocationToMap(e) {
	e.target.parentNode.classList.add('is-added');

	const id = parseInt(e.target.dataset.id);
	MWGTM_STATE.recentMaps = MWGTM_STATE.recentMaps.filter(e => e.id !== id).slice(0, 2);
	for(let map of MAP_LIST) {
		if(map.id === id) {
			MWGTM_STATE.recentMaps.unshift(map);
			break;
		}
	}
	saveState();

	importLocations(id, [{
		id: -1,
		location: {lat: LOCATION.lat, lng: LOCATION.lng},
		panoId: LOCATION.panoId ?? null,
		heading: LOCATION.heading,
		pitch: LOCATION.pitch,
		zoom: LOCATION.zoom === 0 ? null : LOCATION.zoom,
		tags: document.getElementById('mwgtm-map-tags').value.split(',').map(t => t.trim()).filter(t => t.length > 0),
		flags: LOCATION.panoId ? 1 : 0
	}]);
}

function addSettingsButtonsToSummary() {
	const container = document.querySelector(`div[data-qa="result-view-top"]`);

	if(!container || document.getElementById('mwgtm-settings-buttons-summary')) return;

	const element = document.createElement('div');
	element.id = 'mwgtm-settings-buttons-summary';
	element.className = 'mwgtm-settings';
	element.innerHTML = `
		<div class="mwgtm-settings-option" id="mwgtm-opt-save-loc">SAVE TO MAP</div>
	`;

	container.appendChild(element);

	createSettingsButtonSummaryEvents();
}

function createSettingsButtonSummaryEvents() {
	document.getElementById('mwgtm-opt-save-loc').addEventListener('click', () => {
		clickedMapButton();
	});
}

GeoGuessrEventFramework.init().then(GEF => {
	GEF.events.addEventListener('round_end', (state) => {
		const loc = state.detail.rounds[state.detail.rounds.length - 1]?.location;
		if(!loc) return;

		LOCATION = loc;
		addSettingsButtonsToSummary();
	});
});

let MWGTM_SV, MWGTM_M, MWGTM_SVC;
