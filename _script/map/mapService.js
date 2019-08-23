var map;
var MapService = (function () {

	var me = {};

	var mapSources = {};
	var mapLoaded;
	var initStyleLoaded;
	var updateHashTimeout;
	var popupHover;

	me.init = function () {
		mapboxgl.accessToken = 'pk.eyJ1IjoiaXBpc3Jlc2VhcmNoIiwiYSI6IklBazVQTWcifQ.K13FKWN_xlKPJFj9XjkmbQ';

		var hash = document.location.hash.substr(1);
		decodeHash(hash);

		map = new mapboxgl.Map({
			container: 'map',
			style: Config.initStyle || 'mapbox://styles/ipisresearch/ciw6jpn5s002r2jtb615o6shz',
			center: [Config.mapCoordinates.x, Config.mapCoordinates.y],
			zoom: Config.mapCoordinates.zoom
		});

		map.on("zoomend", function () {
			updateHash("zoom ended");
		});

		map.on("moveend", function () {
			updateHash("move ended");
		});

		map.on("click", UI.hideDashboard);

		// Create a hover popup, but don't add it to the map yet.
		popupHover = new mapboxgl.Popup({
			closeButton: false,
			closeOnClick: false
		});

		map.on('style.load', function (e) {
			for (var key in Config.layers) {


				if (Config.layers.hasOwnProperty(key)) {
					var layer = Config.layers[key];
					layer.display = layer.display || {visible: true};

					if (typeof layer.display.visible === "undefined") layer.display.visible = true;

					if (layer.filterId && Config.initLayerIds.length) {
						//layer.display.visible = Config.initLayerIds.indexOf("" + layer.filterId) >= 0;
					}

					if (layer.display.visible) {
						me.addLayer(Config.layers[key]);
						if (layer.containerElm) layer.containerElm.classList.remove("inactive");
						if (layer.labelElm) layer.labelElm.classList.remove("inactive");

						// check initial filter
						if (Config.initfilterIds.length && layer.filters) {
							layer.filters.forEach(function (filter) {
								var state = getFilterState(filter.index);
								if (state && filter.filterItems && filter.filterItems.length) {
									for (var i = 0, max = filter.filterItems.length; i < max; i++) {
										// note: filter state contains a leading "1" to handle leading zeros
										var item = filter.filterItems[i];
										item.checked = state[i + 1] == "1";
										if (item.elm) item.elm.classList.toggle("inactive", !item.checked);
									}
									if (filter.onFilter) filter.onFilter(filter);
								}
							});

						} else {
							if (layer.onLoaded) {
								layer.onLoaded();
							}
						}

					} else {
						if (layer.containerElm) layer.containerElm.classList.add("inactive");
						if (layer.labelElm) layer.labelElm.classList.add("inactive");
						layer.added = false;
					}
				}
			}

			if (!initStyleLoaded) {
				map.addControl(new mapboxgl.NavigationControl(), 'top-left');
				map.addControl(new mapboxgl.ScaleControl({}));
				document.getElementsByClassName("mapboxgl-ctrl-scale")[0].style.cssText = "margin: 0px 0px -22px 105px;border-color: rgba(0,0,0,0.15); border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;"
				initStyleLoaded = true;
			} else {
				updateHash("style loaded");
			}

			EventBus.trigger(EVENT.mapStyleLoaded);

		});

	};

	me.addLayer = function (layer) {
		var sourceOrigin = layer.source;

		if (typeof sourceOrigin === "function") {
			sourceOrigin = layer.source(layer, true);
		}

		if (!sourceOrigin) {
			console.log(layer.id + ": layer data not ready, deferring.");
			return;
		}

		if (typeof sourceOrigin === "string") sourceOrigin = sourceOrigin.replace("%apiScope%", Config.apiScope);

		var sourceId = layer.sourceId || sourceOrigin.replace(/\W/g, '');

		var source = mapSources[sourceId];
		if (!source) {
			map.addSource(sourceId, {
				type: 'geojson',
				data: sourceOrigin,
				buffer: 0,
				maxzoom: 12
			});
		}

		var circleColor;
		var circleRadius;
		var fillColor;
		var lineColor;

		var colorStops = [];
		var iconImageStops = [];

		var paint = {};
		var layout = {
			'visibility': 'visible'
		};

		var displayType = "circle";
		if (layer.display.type) displayType = layer.display.type;

		if (layer.display.type === "circle") {

			if (layer.display.color) {


				circleColor = layer.display.color;

				if (layer.display.color.data){
					var items = layer.display.color.data;
					if (typeof layer.display.color.data === "function") items = layer.display.color.data();
					items.forEach(function (item) {
						colorStops.push([item.value, item.color]);
					});

					circleColor = {
						property: layer.display.color.property,
						type: 'categorical',
						stops: colorStops,
						default: layer.display.color.defaultColor || 'grey'
					}
				}



			}

			if (layer.display.size) {
				circleRadius = {
					'default': 3,
					'property': layer.display.size.property,
					'type': 'interval',
					'stops': layer.display.size.interval
				}
			}

			paint = {
				'circle-color': circleColor || layer.display.circleColor || "blue",
				'circle-radius': circleRadius || layer.display.circleRadius || 1,
				'circle-opacity': layer.display.circleOpacity || 1,
				'circle-blur': layer.display.circleBlur || 0,
				'circle-stroke-width': layer.display.circleStrokeWidth || 0.5,
				'circle-stroke-color': layer.display.circleStrokeColor || 'white'
			};
		}

		if (displayType === "fill") {
			if (layer.display.fillColor.data) {
				var items = layer.display.fillColor.data;
				if (typeof layer.display.fillColor.data === "function") items = layer.display.fillColor.data();
				items.forEach(function (item) {
					colorStops.push([item.value, item.color]);
				});

				fillColor = {
					property: layer.display.fillColor.property,
					type: 'categorical',
					stops: colorStops
				}
			} else {
				if (layer.display.fillColor) {
					fillColor = layer.display.fillColor
				}
			}

			paint = {
				'fill-color': fillColor || '#808080',
				'fill-opacity': layer.display.fillOpacity || 0.7
			}
		}

		if (displayType === "line") {
			if (layer.display.lineColor.data) {
				var items = layer.display.lineColor.data;
				if (typeof layer.display.lineColor.data === "function") items = layer.display.lineColor.data();
				items.forEach(function (item) {
					colorStops.push([item.value, item.color]);
				});

				lineColor = {
					property: layer.display.lineColor.property,
					type: 'categorical',
					stops: colorStops
				}
			} else {
				if (layer.display.lineColor) {
					lineColor = layer.display.lineColor
				}
			}

			paint = {
				'line-color': lineColor || '#808080',
				'line-opacity': layer.display.lineOpacity || 0.7,
				'line-width': layer.display.lineWidth || 1
			};

			layout = {
				'line-join': 'round',
				'line-cap': 'round'
			}
		}

		if (displayType === "symbol") {
			// list of standard icons: https://github.com/mapbox/mapbox-gl-styles/tree/master/sprites/basic-v9/_svg
			if (layer.display.iconImage.data) {
				var items = layer.display.iconImage.data;
				if (typeof layer.display.iconImage.data === "function") items = layer.display.iconImage.data();
				items.forEach(function (item) {
					iconImageStops.push([item.value, item.iconImage]);
				});

				iconImage = {
					property: layer.display.iconImage.property,
					type: 'categorical',
					stops: iconImageStops
				}
			} else {
				if (layer.display.iconImage) {
					iconImage = layer.display.iconImage
				}
			}

			layout = {
				'icon-image': iconImage || "marker-11",
				'icon-allow-overlap': true,
				'icon-size': layer.display.iconSize || 1
			};

			paint = {
				'icon-opacity': layer.display.iconOpacity || 1
			};
		}

		map.addLayer({
			'id': layer.id,
			'type': displayType,
			'source': sourceId,
			'paint': paint,
			'layout': layout
		}, layer.display.belowLayer);

		layer.added = true;

		if (layer.onClick) {
			map.on('mouseenter', layer.id, function (e) {
				map.getCanvas().style.cursor = 'pointer';

				if (layer.popupOnhover) {

					var geo = e.features[0] ? e.features[0].geometry : undefined;
					var co = e.lngLat;

					if (geo) {
						if (geo.coordinates) co = geo.coordinates;
						if (geo.type == "Polygon") co = MapBoxExtra.polylabel(co);
						if (geo.type == "MultiPolygon") co = MapBoxExtra.polylabel(co[0]);
					}

					if (typeof layer.popupOnhover === "function") {
						var HTML = layer.popupOnhover(e.features[0]);
					} else {
						HTML = e.features[0].properties[layer.popupOnhover];
					}

					popupHover.setLngLat(co)
						.setHTML(HTML)
						.addTo(map);


				}
			});
			map.on('mouseleave', layer.id, function (e) {
				map.getCanvas().style.cursor = '';
				popupHover.remove();
			});
			map.on('click', layer.id, function (e) {
				if (e.features.length > 1) {
					// TODO: Spiderify ?
				}

				// prevent a click to propagate to all layers
				if (e && e.originalEvent) {
					if (e.originalEvent.cancelBubble) return;
					e.originalEvent.cancelBubble = true;
				}

				popupHover.remove();
				layer.onClick(e.features[0], e.lngLat);
			});
		}

		if (layer.onLoaded) {
			layer.onLoaded();
		}

		map.on("render", function () {
			if (map.loaded()) {
				if (!mapLoaded) {
					mapLoaded = true;
					if (layer.onLoaded) layer.onLoaded();
					updateHash("render");
				}

				if (UI.onRender) UI.onRender();
			}
		});


	};


	me.urlToStyle = function (styleUrl, attribution) {
		if (styleUrl.indexOf('mapbox://') > -1) {
			return styleUrl;
		} else {
			var style = {
				"version": 8,
				"sources": {
					"raster-source": {
						"type": "raster",
						"tiles": [styleUrl],
						"tileSize": 256
					},
					"dummy": {
						"type": "geojson",
						"data": {"type": "Feature", "geometry": null}
					}
				},
				"layers": [
					{
						"id": "raster-layer",
						"type": "raster",
						"source": "raster-source"
					},
					{
						"id": "ref_layer_pdv",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_roadblocks",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_mines",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_tradelines",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_armedgroupareas",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_concessions",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					},
					{
						"id": "ref_layer_protectedAreas",
						"type": "circle",
						"layout": {"visibility": "none"},
						"source": "dummy"
					}
				],
				"sprite": "http://ipis.annexmap.net/sprites/mapbox-v1" // note: relative urls are not supported - see https://github.com/mapbox/mapbox-gl-js/pull/7153
			};
			if (attribution) {
				style.sources["raster-source"].attribution = attribution
			}
			return style
		}

		// documentation for the sprites:
		// https://www.mapbox.com/mapbox-gl-js/style-spec/#sources-raster
		// TODO: we should generate a minimal spritemap with only the icons we use.
		// see https://github.com/mapbox/spritezero-cli
		// Note: why are .svg images being converted to .png?
	};

	me.setStyle = function (styleUrl, attribution) {
		map.setStyle(me.urlToStyle(styleUrl, attribution));
	};


	// updates the url Hash so links can reproduce the current map state
	function updateHash(reason) {
		console.log("update hash " + reason);
		clearTimeout(updateHashTimeout);

		updateHashTimeout = setTimeout(function () {
			var zoom = map.getZoom();
			var center = map.getCenter();
			var bounds = map.getBounds();

			var latitude = center.lat;
			var longitude = center.lng;

			var baseLayer = 0;

			var layerIds = [];
			var filterIds = [];

			Config.baselayers.forEach(function (layer) {
				if (layer.active) baseLayer = layer.index;
			});

			/*var yearClamp = Data.getYearClamp();
			if (yearClamp.start){
			  filterIds.push("1." + (yearClamp.start-2000) + "." + (yearClamp.end-2000));
			}*/


			for (var key in Config.layers) {
				if (Config.layers.hasOwnProperty(key)) {
					var layer = Config.layers[key];
					if (layer.id && layer.filterId) {
						if (map.getLayer(layer.id)) {
							if (map.getLayoutProperty(layer.id, 'visibility') !== "none") {
								layerIds.push(layer.filterId);

								if (layer.filters && layer.filters.length) {
									layer.filters.forEach(function (filter) {
										if (filter.index) {
											var index = filter.index;
											if (filter.filterItems && filter.filterItems.length) {
												var max = filter.filterItems.length;
												var count = 0;
												var a = [1];
												filter.filterItems.forEach(function (e) {
													if (e.checked) {
														a.push(1);
														count++;
													} else {
														a.push(0);
													}
												});
												if (count < max) {
													// this filter has a state - decode binary state as base36
													index += "." + parseInt(a.join(""), 2).toString(36);
													filterIds.push(index);
												}
											}
										}
									});
								}
							}
						}
					}
				}
			}

			var hash = latitude + "/" + longitude + "/" + zoom + "/" + baseLayer + "/" + layerIds.join(",") + "/" + filterIds.join(",");
			decodeHash(hash);
			window.location.hash = hash;
		}, 50);

	}

	function decodeHash(hash) {

		Config.initLayerIds = ["1"];
		Config.initfilterIds = [];
		Config.initBaselayer = Config.defaultBaseLayerIndex;

		if (hash.indexOf("/") > 0) {
			var urlparams = hash.split("/");
			if (urlparams.length > 2) {
				Config.mapCoordinates.y = urlparams[0];
				Config.mapCoordinates.x = urlparams[1];
				Config.mapCoordinates.zoom = urlparams[2];
				Config.initBaselayer = urlparams[3] || 2;
				if (urlparams[4]) Config.initLayerIds = (urlparams[4]).split(",");
				if (urlparams[5]) Config.initfilterIds = (urlparams[5]).split(",");
			}
		}

		Config.baselayers.forEach(function (baseLayer) {
			if (Config.initBaselayer == baseLayer.index) {
				Config.initStyle = me.urlToStyle(baseLayer.url, baseLayer.attribution);
				baseLayer.active = true;
			}
		});

	}

	function getFilterState(index) {
		var sIndex = index + ".";
		var sLen = sIndex.length;
		for (var i = 0, max = Config.initfilterIds.length; i < max; i++) {
			if (Config.initfilterIds[i].substr(0, sLen) == sIndex) {
				var stateString = Config.initfilterIds[i].substr(sLen);
				if (stateString) {
					return parseInt(stateString, 36).toString(2).split("");
				}
			}
		}
	}

	EventBus.on(EVENT.filterChanged, function () {
		updateHash("filter Changed");
	});

	EventBus.on(EVENT.layerChanged, function () {
		updateHash("layer Changed");
	});

	// utility to get unique properties in source
	me.distinct = function (source, property) {
		var list = map.querySourceFeatures(source);
		var result = [];
		var lookup = {};
		list.forEach(function (item) {
			var value = item.properties[property];
			if (value && !lookup[value]) {
				result.push(value);
				lookup[value] = true;
			}
		});

		result.sort();
		return result;
	};

	me.addSubLayer = function(subLayer){
		Config.subLayers = Config.subLayers || {};
		Config.subLayers[subLayer.id] = subLayer;
		if (subLayer.onClick) me.attachClickEvents(subLayer);
	};

	me.getFilterItems = function (source, property, mapping) {
		var filterList = me.distinct(source, property);
		filterList.sort();
		var keyMapping = !!mapping;
		if (!keyMapping) mapping = palette('tol-rainbow', filterList.length);

		var filterItems = [];
		filterList.forEach(function (item, index) {
			var label = item;
			var color = "grey";
			if (keyMapping) {
				if (mapping[item]) {
					color = mapping[item].color || mapping[item];
					label = mapping[item].label || label
				}
			} else {
				color = "#" + (mapping[index] || "CCCCCC");
			}
			filterItems.push({label: label, value: item, color: color});
		});

		return filterItems;
	};

	// filters on 1 property - supports sublayers
	me.genericFilter = function (elm) {
		var items = elm.filterItems;
		var hasFilter = false;
		var values = [];
		items.forEach(function (item) {
			if (!item.checked) {
				hasFilter = true;
			} else {
				values.push(item.value);
			}
		});

		var layerId = elm.layer.id;

		if (hasFilter) {
			map.setFilter(layerId, ["in", (elm.filterProperty || elm.id)].concat(values));

			if (elm.layer.subLayers) {
				elm.layer.subLayers.forEach(function (sublayer, index) {
					if (!sublayer.isHover) {
						map.setFilter(layerId + index, ["in", (elm.filterProperty || elm.id)].concat(values));
					}
				});
			}
		} else {
			map.setFilter(layerId);
			if (elm.layer.subLayers) {
				elm.layer.subLayers.forEach(function (sublayer, index) {
					if (!sublayer.isHover) {
						map.setFilter(layerId + index);
					}
				});
			}
		}

		if (elm.layer.placeholder) {
			layerId = elm.layer.id.split("_")[0];
			if (hasFilter) {
				map.setFilter(layerId, ["in", (elm.filterProperty || elm.id)].concat(values));
			} else {
				map.setFilter(layerId);
			}
		}

		if (elm.layer.onFilter){
			elm.layer.onFilter();
		}
	};


	me.genericMultiFilter = function (elm) {


		elm.layer.filterFunctionLookup = elm.layer.filterFunctionLookup || {};

		var values = [];
		elm.filterItems.forEach(function (item) {
			if (item.checked) values.push(item.value);
		});

		if (values.length === elm.filterItems.length) {
			// all items checked - ignore filter
			elm.layer.filterFunctionLookup[elm.id] = undefined;
		} else {
			if (elm.array) {
				elm.layer.filterFunctionLookup[elm.id] = function (item) {
					var value = item.properties[elm.filterProperty];

					// why do arrays get converted back to string in GeoJson structures?
					if (typeof value === "string"){
						try{
							value = JSON.parse(value);
						}catch (e) {
							value = [];
						}
					}
					if (value && value.length) {
						return value.some(function (v) {
							return values.includes(v);
						});
					}
					return false;
				};
			} else {
				elm.layer.filterFunctionLookup[elm.id] = function (item) {
					return values.includes(item.properties[elm.filterProperty]);
				};
			}
		}


		me.filterLayerGenericMulti(elm);

	};

	me.filterLayerGenericMulti = function (elm) {
		var filteredIds = [];
		var filtered = [];
		var filterFunctions = [];
		elm.layer.filterFunctionLookup = elm.layer.filterFunctionLookup || {};

		for (var key in elm.layer.filterFunctionLookup) {
			if (elm.layer.filterFunctionLookup.hasOwnProperty(key) && elm.layer.filterFunctionLookup[key]) {
				filterFunctions.push(elm.layer.filterFunctionLookup[key]);
			}
		}

		map.querySourceFeatures(elm.layer.id).forEach(function (feature) {
			var passed = true;
			var filterCount = 0;
			var filterMax = filterFunctions.length;
			while (passed && filterCount < filterMax) {
				passed = filterFunctions[filterCount](feature);
				filterCount++;
			}


			if (passed) {
				filtered.push(feature);
				filteredIds.push(feature.properties.id);
			}
		});

		map.setFilter(elm.layer.id, ['in', 'id'].concat(filteredIds));

		if (elm.layer.onFilter){
			elm.layer.onFilter();
		}
	};


	return me;

}());
