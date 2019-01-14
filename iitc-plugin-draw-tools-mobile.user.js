// ==UserScript==
// @id             iitc-plugin-new-portals@setup
// @name           IITC plugin: New Portals
// @category       Layer
// @version        0.1.0
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @description    [0.1.0] Track new portals. This plugin allows marking portals as verified, and highlight new created recently. Use 'draw tools' plugin to be able to select areas and mass marking as verified. Use the 'sync' plugin to share between multiple browsers or desktop/mobile.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// @updateURL      https://github.com/piczkaczu/iitc-new-portals/blob/master/iitc-new-portals.meta.js
// @downloadURL    https://github.com/piczkaczu/iitc-new-portals/blob/master/iitc-new-portals.user.js
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};


//PLUGIN START ////////////////////////////////////////////////////////

//use own namespace for plugin
window.plugin.newPortals = function() {};

//delay in ms
window.plugin.newPortals.SYNC_DELAY = 5000;

// maps the JS property names to localStorage keys
window.plugin.newPortals.FIELDS = {
	'newPortals': 'plugin-newPortals-data',
	'updateQueue': 'plugin-newPortals-data-queue',
	'updatingQueue': 'plugin-newPortals-data-updating-queue',
};

window.plugin.newPortals.newPortals = {};
window.plugin.newPortals.updateQueue = {};
window.plugin.newPortals.updatingQueue = {};

window.plugin.newPortals.enableSync = false;

window.plugin.newPortals.disabledMessage = null;
window.plugin.newPortals.contentHTML = null;

window.plugin.newPortals.isHighlightActive = false;

/**
 * Very simple logger.
 */
function LOG() {
	var args = Array.prototype.slice.call(arguments); // Make real array from arguments
	args.unshift("[newPortals] ");
	console.log.apply(console, args);
}
function LOGwarn() {
	var args = Array.prototype.slice.call(arguments); // Make real array from arguments
	args.unshift("[newPortals] ");
	console.warn.apply(console, args);
}

/**
 * Portal details loaded.
 */
window.plugin.newPortals.onPortalDetailsUpdated = function() {
	if(typeof(Storage) === "undefined") {
		$('#portaldetails > #resodetails').before(plugin.newPortals.disabledMessage);
		return;
	}

	var guid = window.selectedPortal,
		details = portalDetail.get(guid),
		nickname = window.PLAYER.nickname;
	if(details) {
		function installedByPlayer(entity) {
			return entity && entity.owner == nickname;
		}
	}

	// append all-captured checkbox
	$('#portaldetails > #resodetails').before(plugin.newPortals.contentHTML);
	$('#portaldetails input#newPortals-captured').click(function () {
		var captured = this.checked;
		plugin.newPortals.updateCaptured(captured);
	});

	// init state
	plugin.newPortals.updateCheckedAndHighlight(guid);
};

/**
 * Update/init checboxes state.
 * @param {String} guid
 * @returns {undefined}
 */
window.plugin.newPortals.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginnewPortalsUpdatenewPortals', { guid: guid });

	// this portal details are opened
	if (guid == window.selectedPortal) {

		var portalState = plugin.newPortals.getPortalState(guid);
		$('#portaldetails input#newPortals-captured').prop('checked', portalState.all);
		// all selected
		if (portalState.all) {
			LOG('quick init - all captured');
			$('#portaldetails input.newPortals-resonator').prop('checked', true);
		// all un-selected
		} else {
			LOG('quick init - all un-captured');
			$('#portaldetails input.newPortals-resonator').prop('checked', false);
		}
	}

	if (window.plugin.newPortals.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
	}
};

/**
 * State object for this plugin.
 *
 * Note. This just for documentation.
 *
 * @returns {PortalState}
 */
function PortalState() {
	/**
	 * True if verified.
	 */
	this.all = false;
	// add maybe automation? -- read captures from intel and mark as maybe?
}

/**
 * Fix in-proper values and/or add default values.
 *
 * @param {PortalState} portalState
 * @returns {PortalState}
 */
function fixPortalState(portalState) {
	if (typeof portalState.all !== 'boolean') {
		portalState.all = false;
	}
	return portalState;
}

/**
 * Gets or create (initialize) state for the portal.
 *
 * Note! This also sets the initial portal state.
 *
 * @param {String} guid Portal GUID.
 * @returns {PortalState} State object.
 */
window.plugin.newPortals.getOrCreatePortalState = function(guid) {
	var portalState = plugin.newPortals.newPortals[guid];
	// create
	if (!portalState) {
		plugin.newPortals.newPortals[guid] = portalState = {};
		// add defaults
		fixPortalState(portalState);
	}
	// fix in-proper values or un-freeze
	else {
		if (Object.isFrozen(portalState)) {
			LOGwarn('portalState is frozen - replacing it');
			portalState = $.extend({}, portalState);
			plugin.newPortals.newPortals[guid] = portalState;
		}
		fixPortalState(portalState);
	}
	return portalState;
};

/**
 * Gets state for the portal.
 *
 * Note! You MUST NOT assume that changes to returend object will reflect state changes.
 * You SHOULD NOT change returned object.
 *
 * @param {String} guid Portal GUID.
 * @returns {PortalState} State object.
 */
window.plugin.newPortals.getPortalState = function(guid) {
	var portalState = plugin.newPortals.newPortals[guid];
	if (!portalState) {
		portalState = {};
	}
	fixPortalState(portalState);
	return portalState;
};

/**
 * Update/set captured (verified) state.
 *
 * Note. Switching off verified state will bring back previously set state.
 *
 * @param {Boolean} fullyCaptured Is verified for sure.
 * @param {String} guid [optional] Portal GUID (defaults to `selectedPortal`).
 * @param {Boolean} delaySync [optional] (default=false) If true then data will not be saved to server nor will portal details state change.
 */
window.plugin.newPortals.updateCaptured = function(fullyCaptured, guid, delaySync) {
	if(guid == undefined) guid = window.selectedPortal;

	if (!delaySync) {
		LOG('updateCaptured: ', fullyCaptured, guid);
	}

	var portalState = plugin.newPortals.getOrCreatePortalState(guid);
	var stateChanged = false;

	if (fullyCaptured !== portalState.all) {
		stateChanged = true;
		portalState.all = fullyCaptured;
	}

	if (delaySync) {
		return;
	}

	if(!stateChanged) {
		LOGwarn('state didn\'t change');
		return;
	}

	plugin.newPortals.updateCheckedAndHighlight(guid);
	plugin.newPortals.sync(guid);
};

// <editor-fold desc="Selected portals tools" defaultstate="collapsed">
/**
 * Checks if the point is contained within a polygon.
 *
 * Based on //https://rosettacode.org/wiki/Ray-casting_algorithm
 *
 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
 * @param {Object} point LatLng point to check.
 * @returns {Boolean}
 */
var rayCastingUtils = {
	/**
	 * Checks if the point is contained within a polygon.
	 *
	 * Based on //https://rosettacode.org/wiki/Ray-casting_algorithm
	 *
	 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
	 * @param {Object} point LatLng point to check.
	 * @returns {Boolean}
	 */
	contains : function (polygonPoints, point) {
		var lat = point.lat;
		var lng = point.lng;
		var count = 0;
		for (var b = 0; b < polygonPoints.length; b++) {
			var vertex1 = polygonPoints[b];
			var vertex2 = polygonPoints[(b + 1) % polygonPoints.length];
			if (this.west(vertex1, vertex2, lng, lat))
				++count;
		}
		return count % 2 ? true : false;
	},
	/**
	 * @param {Object} A 1st point of an edge.
	 * @param {Object} B 2nd point of an edge.
	 * @param {Number} lng
	 * @param {Number} lat
     * @return {boolean} true if (lng,lat) is west of the line segment connecting A and B
	 */
    west : function (A, B, lng, lat) {
        if (A.lat <= B.lat) {
            if (lat <= A.lat || lat > B.lat ||
                lng >= A.lng && lng >= B.lng) {
                return false;
            } else if (lng < A.lng && lng < B.lng) {
                return true;
            } else {
                return (lat - A.lat) / (lng - A.lng) > (B.lat - A.lat) / (B.lng - A.lng);
            }
        } else {
            return this.west(B, A, lng, lat);
        }
    }
};

/**
 * Get visible portals withing given bounds.
 *
 * @param {L.LatLngBounds} bounds Rectangular bounds.
 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
 * @returns {Array} Array of guids for portals that are within bounds.
 */
window.plugin.newPortals.getPortalsInBounds = function(bounds, polygonPoints) {
	var visiblePortals = [];
	$.each(window.portals, function(guid,portal) {
		var ll = portal.getLatLng();
		var isInside = false;
		if (bounds.contains(ll)) {
			if (!polygonPoints) {
				isInside = true;
			} else if (rayCastingUtils.contains(polygonPoints, ll)) {
				isInside = true;
			}
		}
		if (isInside) {
			visiblePortals.push(guid);
		}
	});
	return visiblePortals;
};

/**
 * Get polygons that are fully visible.
 * 
 * @returns {Array} Array of `L.Polygon`
 */
window.plugin.newPortals.getVisiblePolygons = function() {
	if (!window.plugin.drawTools) {
		return [];
	}

	var visibleBounds = map.getBounds();

	var polygons = [];
	window.plugin.drawTools.drawnItems.eachLayer(function(layer) {
		if (!(layer instanceof L.Polygon)) {
			return;
		}

		if (visibleBounds.contains(layer.getBounds())) {
			polygons.push(layer);
		}
	});

	return polygons;
};

/**
 * Get polygons that are in fully visible polygons.
 *
 * @returns {Array} Array of guids for portals that are within bounds.
 */
window.plugin.newPortals.getSelectedPortals = function() {
	var selection = {
		polygons: [],
		portals: []
	};
	if (!window.plugin.drawTools) {
		return selection;
	}

	// find visible polygons
	var polygons = window.plugin.newPortals.getVisiblePolygons();
	if (polygons.length === 0) {
		return selection;
	}
	selection.polygons = polygons;

	// find and set state for portals in polygons
	for (var i = 0; i < polygons.length; i++) {
		var selectedPortals = window.plugin.newPortals.getPortalsInBounds(
			polygons[i].getBounds(),
			polygons[i].getLatLngs()
		);
		for (var j = 0; j < selectedPortals.length; j++) {
			if (selection.portals.indexOf(selectedPortals[j]) < 0) {	// avoid duplicates
				selection.portals.push(selectedPortals[j]);
			}
		}
	}

	return selection;
};
// </editor-fold>

window.plugin.newPortals.updateVisiblePortals = function(fullyCaptured) {
	if (!window.plugin.drawTools) {
		alert('Error: You must install draw tools before using this function.');
		return;
	}

	// find portals in visible polygons
	var selection = window.plugin.newPortals.getSelectedPortals();

	// empty selection info
	if (selection.polygons.length === 0) {
		alert('No polygons are visible in this view. \n\
			Note that the polygon must be fully visible (all corners must be in view).');
		return;
	}
	if (selection.portals.length === 0) {
		alert('No portals are visible in the visible polygon(s).');
		return;
	}

	// confirmation
	if (!confirm('Are you sure you want to change state for all selected portals ('+selection.portals.length+')?')) {
		return;
	}

	// find and set state for portals in polygons
	for (var i = 0; i < selection.portals.length; i++) {
		var guid = selection.portals[i];
		plugin.newPortals.updateCaptured(fullyCaptured, guid, true);
	}
	plugin.newPortals.massPortalsUpdate(selection.portals);
};

/**
 * Saves state of many portals to server and runs GUI updates.
 *
 * This should be run after many portal state changes.
 * Use especially with `delaySync=true` in `updateCaptured`.
 *
 * @param {Array} portals Portal GUIDs
 */
window.plugin.newPortals.massPortalsUpdate = function(portals) {
	// a full update - update the selected portal sidebar
	if (window.selectedPortal) {
		plugin.newPortals.updateCheckedAndHighlight(window.selectedPortal);
	}
	// and also update all highlights, if needed
	if (window.plugin.newPortals.isHighlightActive) {
		resetHighlightedPortals();
	}

	// make sure changes are saved locally (should not be required, but...)
	plugin.newPortals.storeLocal('newPortals');
	// save to server
	plugin.sync.updateMap('newPortals', 'newPortals', portals);
};

// <editor-fold desc="Storage/sync" defaultstate="collapsed">

/**
 * Forces saving all portals.
 */
window.plugin.newPortals.forceSync = function() {
	var allGuids = Object.keys(plugin.newPortals.newPortals);
	// confirmation
	if (!confirm('Are you REALLY sure you want to force saving all portals ('+allGuids.length+')?')) {
		return;
	}
	plugin.sync.updateMap('newPortals', 'newPortals', allGuids);
};

// stores the gived GUID for sync
plugin.newPortals.sync = function(guid) {
	plugin.newPortals.updateQueue[guid] = true;
	plugin.newPortals.storeLocal('newPortals');
	plugin.newPortals.storeLocal('updateQueue');
	plugin.newPortals.syncQueue();
};

// sync the queue, but delay the actual sync to group a few updates in a single request
window.plugin.newPortals.syncQueue = function() {
	if(!plugin.newPortals.enableSync) return;
	
	clearTimeout(plugin.newPortals.syncTimer);
	
	plugin.newPortals.syncTimer = setTimeout(function() {
		plugin.newPortals.syncTimer = null;

		$.extend(plugin.newPortals.updatingQueue, plugin.newPortals.updateQueue);
		plugin.newPortals.updateQueue = {};
		plugin.newPortals.storeLocal('updatingQueue');
		plugin.newPortals.storeLocal('updateQueue');

		plugin.sync.updateMap('newPortals', 'newPortals', Object.keys(plugin.newPortals.updatingQueue));
	}, plugin.newPortals.SYNC_DELAY);
};

//Call after IITC and all plugin loaded
window.plugin.newPortals.registerFieldForSyncing = function() {
	LOG('registerFieldForSyncing');
	if(!window.plugin.sync) {
		LOGwarn('sync. not ready');
		return;
	}
	window.plugin.sync.registerMapForSync('newPortals', 'newPortals', window.plugin.newPortals.syncCallback, window.plugin.newPortals.syncInitialed);
};

//Call after local or remote change uploaded
window.plugin.newPortals.syncCallback = function(pluginName, fieldName, e, fullUpdated) {
	if(fieldName === 'newPortals') {
		plugin.newPortals.storeLocal('newPortals');
		// All data is replaced if other client update the data during this client
		// offline,
		// fire 'pluginnewPortalsRefreshAll' to notify a full update
		if(fullUpdated) {
			// a full update - update the selected portal sidebar
			if (window.selectedPortal) {
				plugin.newPortals.updateCheckedAndHighlight(window.selectedPortal);
			}
			// and also update all highlights, if needed
			if (window.plugin.newPortals.isHighlightActive) {
				resetHighlightedPortals();
			}

			window.runHooks('pluginnewPortalsRefreshAll');
			return;
		}

		if(!e) return;
		if(e.isLocal) {
			// Update pushed successfully, remove it from updatingQueue
			delete plugin.newPortals.updatingQueue[e.property];
		} else {
			// Remote update
			delete plugin.newPortals.updateQueue[e.property];
			plugin.newPortals.storeLocal('updateQueue');
			plugin.newPortals.updateCheckedAndHighlight(e.property);
			window.runHooks('pluginnewPortalsUpdatenewPortals', {guid: e.property});
		}
	}
};

//syncing of the field is initialed, upload all queued update
window.plugin.newPortals.syncInitialed = function(pluginName, fieldName) {
	if(fieldName === 'newPortals') {
		plugin.newPortals.enableSync = true;
		if(Object.keys(plugin.newPortals.updateQueue).length > 0) {
			plugin.newPortals.syncQueue();
		}
	}
};

window.plugin.newPortals.storeLocal = function(name) {
	var key = window.plugin.newPortals.FIELDS[name];
	if(key === undefined) return;

	var value = plugin.newPortals[name];

	if(typeof value !== 'undefined' && value !== null) {
		localStorage[key] = JSON.stringify(plugin.newPortals[name]);
	} else {
		localStorage.removeItem(key);
	}
};

window.plugin.newPortals.loadLocal = function(name) {
	var key = window.plugin.newPortals.FIELDS[name];
	if(key === undefined) return;

	if(localStorage[key] !== undefined) {
		plugin.newPortals[name] = JSON.parse(localStorage[key]);
	}
};
// </editor-fold>

// <editor-fold desc="Highlighter" defaultstate="collapsed">
window.plugin.newPortals.highlighter = {
	title: 'New Portals',	// this is set in setup as a user-visible name
	
	highlight: function(data) {
		var guid = data.portal.options.ent[0];
		var portalState = plugin.newPortals.getPortalState(guid);

		var style = {};

		// Opaque -- fully verified.
		if (portalState.all) {
			style.fillOpacity = 0.1;
			style.opacity = 0;
		}
		// Red -- not verified.
		else {
			style.fillColor = 'red';
			style.fillOpacity = 0.7;
		}
		/*
		// Yellow -- maybe state?
		else {
			style.fillColor = 'gold';
			style.fillOpacity = 0.8;
		}
		*/

		data.portal.setStyle(style);
	},

	setSelected: function(active) {
		window.plugin.newPortals.isHighlightActive = active;
	}
};
// </editor-fold>


window.plugin.newPortals.setupCSS = function() {
	$("<style>")
	.prop("type", "text/css")
	.html("\
	#newPortals-container {\n\
		display: block;\n  text-align: center;\n\
		margin: .6em 0 .3em;\n\
		padding: 0 .5em;\n\
	}\n\
	#newPortals-container label {\n\
		margin: 0 .5em;\n\
	}\n\
	#newPortals-container input {\n\
		vertical-align: middle;\n\
	}\n\
	")
	.appendTo("head");
};

  // Manual import, export and reset data
window.plugin.newPortals.openDialog = function() {
    dialog({
		html: plugin.newPortals.dialogContentHTML,
		dialogClass: 'ui-dialog-newPortals',
		title: 'New Portals'
    });
	// move to top
	$('.ui-dialog-newPortals').offset({top:0});
};

window.plugin.newPortals.setupContent = function() {
	plugin.newPortals.contentHTML = '<div id="newPortals-container">'
			+ '<p><label><input type="checkbox" id="newPortals-captured">Verified</label></p>'
		+ '</div>'
	;
	plugin.newPortals.disabledMessage = '<div id="newPortals-container" class="help" title="Your browser does not support localStorage">Plugin New Portals disabled</div>';

	// add link in toolkit to open dialog
	$('#toolbox').append('<a \n\
		onclick="plugin.newPortals.openDialog();return false;" \n\
		title="New Portals mass operations for current selection">New Portals</a>');

	// dialog
	plugin.newPortals.dialogContentHTML = ''
		+'<p>Draw polygon(s) to "select" portals.<p>'
		+'<p>Mark selected portals as: '
			+'<a id="newPortals-massOp-done" onclick="plugin.newPortals.updateVisiblePortals(true); return false"> Done</a> '
			+' &bull; '
			+'<a id="newPortals-massOp-undone" onclick="plugin.newPortals.updateVisiblePortals(false); return false"> Not done</a>'
		+'</p>'
	;

	// leaflet (sidebar buttons)
	$('.leaflet-control-container .leaflet-top.leaflet-left').append(''
		+'<div class="leaflet-control-new-Portals leaflet-bar leaflet-control">'
		+'	<a class="leaflet-control-new-Portals-done" href="#" title="new Portals done" onclick="plugin.newPortals.updateVisiblePortals(true); return false">✅</a>'
		+'	<a class="leaflet-control-new-Portals-undone" href="#" title="new Portals undone" onclick="plugin.newPortals.updateVisiblePortals(false); return false">❌</a>'
		+'</div>'
	);
};

var setup = function() {
	window.pluginCreateHook('pluginnewPortalsUpdatenewPortals');
	window.pluginCreateHook('pluginnewPortalsRefreshAll');

	window.plugin.newPortals.setupCSS();
	window.plugin.newPortals.setupContent();
	window.plugin.newPortals.loadLocal('newPortals');
	window.addPortalHighlighter(window.plugin.newPortals.highlighter.title, window.plugin.newPortals.highlighter);
	window.addHook('portalDetailsUpdated', window.plugin.newPortals.onPortalDetailsUpdated);
	// seems like on FF desktop IITC might already be loaded here
	if (window.iitcLoaded) {
		LOG('iitc already loaded');
		window.plugin.newPortals.registerFieldForSyncing();
	} else {
		window.addHook('iitcLoaded', function () {
			LOG('iitcLoaded hook');
			window.plugin.newPortals.registerFieldForSyncing();
		});
	}
	/*
	window.addHook('mapDataRefreshEnd', function () {
		LOG('mapDataRefreshEnd hook');
		window.plugin.newPortals.registerFieldForSyncing();
	});
	*/
};

//PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


