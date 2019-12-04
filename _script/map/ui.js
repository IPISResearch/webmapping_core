var UI = function(){
	var me = {};

	var menuContainer;
	var currentPopup;
	var dashBoard;
	var currentDashBoardTab;
	var currentLoader;

	me.init = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.innerHTML = Template.get("menu");
		menuContainer.className = "active";
		window.document.title = "IPIS Map " + (Config.mapName || Config.mapId || "");

		me.buildMenu();

		document.body.classList.remove("loading");

		EventBus.trigger(EVENT.UIReady);
	};

	me.showLoader = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.className = "preloader";
		menuContainer.innerHTML = Template.get("loading");
		document.body.classList.add("loading");
	};

	me.showLoaderTimeOut = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.innerHTML = Template.get("timeout");
	};

	me.showLoaderError = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.className = "preloader big";
		menuContainer.innerHTML = Template.get("loadererror");
	};

	me.showLogin = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.className = "preloader big";
		menuContainer.innerHTML = Template.get("login");
		document.body.classList.add("loading");
	};

	me.doLogin = function(){
		// not hacker-safe but as the password is semi-public it will do.
		var passElm = document.getElementById("password");
		var pass = passElm.value;
		pass = pass.split(".").join("");
		pass = pass.split("/").join("");
		pass = pass.split("\\").join("");
		FetchService.json("data/" + pass + ".json",function(result){
			if (result && result.result && result.result === "ok"){
				createCookie("pass" + Config.apiScope,true,1000);
				Main.initApp();
			}else{
				passElm.value = "";
			}
		})
	};

	me.showDisclaimer = function(firstUse){

		if (firstUse){
			var cookieName = Config.mapId + "_disclaimer";
			var hasReadDisclaimer = readCookie(cookieName);
			if (hasReadDisclaimer) return;
			createCookie(cookieName,true,100);
		}

		var container =  document.getElementById("disclaimer");
		var content =  document.getElementById("disclaimerbody");
		document.body.classList.add("disclaimer");
		FetchService.get(Config.disclaimerUrl,function(html){
			content.innerHTML = html;
			var button = div("button","OK");
			content.appendChild(button);
			button.onclick = me.hideDisclaimer;
			content.onclick = function(e){
				if (!e) {e = window.event;}
				e.cancelBubble = true;
				if (e.stopPropagation) e.stopPropagation();
			};
			container.onclick = me.hideDisclaimer;
		});
	};

	me.hideDisclaimer = function(){
		document.body.classList.remove("disclaimer");
	};

	me.showInfo = function(){

		UI.hideDashboard();
		var container =  document.getElementById("info");
		var content =  document.getElementById("infobody");
		document.body.classList.add("info");
		FetchService.get(Config.infoUrl,function(html){
			content.innerHTML = html;
			var button = div("button","OK");
			content.appendChild(button);
			button.onclick = me.hideInfo;
			content.onclick = function(e){
				if (!e) {e = window.event;}
				e.cancelBubble = true;
				if (e.stopPropagation) e.stopPropagation();
			};
			container.onclick = me.hideInfo;
		});
	};

	me.hideInfo = function(){
		document.body.classList.remove("info");
	};

	me.buildMap = function(){

	};

	me.buildLayer = function(properties){

	};

	me.toggleLayer = function(layer){

		var elm = layer.labelElm;
		var container = layer.containerElm;
		var visible;
		if (elm){
			elm.classList.toggle("inactive");
			visible = !elm.classList.contains("inactive");
		}else{
			if (layer.added) visible = map.getLayoutProperty(layer.id, 'visibility') !== "visible";
		}
		if (container) container.classList.toggle("inactive",!visible);

		if (layer.added){
			map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
		}else{
			if (elm){
				if (currentLoader) removeLoader();
				var loader = '<div class="lds-dual-ring"></div>';
				var loaderContainer = elm.querySelector("i");
				if (loaderContainer) loaderContainer.innerHTML = loader;
				elm.classList.add("loading");
				currentLoader = elm;
			}

			MapService.addLayer(layer);
		}

		if (layer.onToggle){
			layer.onToggle(visible);
		}

		EventBus.trigger(EVENT.layerChanged);

	};

	me.updateFilter = function(filter,item){

		var checkedCount = 0;
		filter.filterItems.forEach(function(e){
			if (e.checked) checkedCount++;
		});

		if (checkedCount === filter.filterItems.length){
			// all items checked -> invert
			filter.filterItems.forEach(function(e){
				e.checked = e.value === item.value;
				if (e.checked){e.elm.classList.remove("inactive")}else{e.elm.classList.add("inactive")}
			});

		}else{
			if (checkedCount === 1 && item.checked){
				// don't allow all select items to be unchecked -> select all
				filter.filterItems.forEach(function(e){
					e.checked = true;
					if (e.checked){e.elm.classList.remove("inactive")}else{e.elm.classList.add("inactive")}
				});
			}else{
				item.checked = !item.checked;
				if (item.checked){item.elm.classList.remove("inactive")}else{item.elm.classList.add("inactive")}
			}
		}

		if (filter.filterElm){
			checkedCount = 0;
			filter.filterItems.forEach(function(e){
				if (e.checked) checkedCount++;
			});
			if (checkedCount === filter.filterItems.length){
				filter.filterElm.classList.remove("hasfilter");
			}else{
				filter.filterElm.classList.add("hasfilter");
			}
		}


		if (filter.onFilter){
			filter.onFilter(filter,item);
		}

	};

	me.clearFilter = function(filter){

		filter.filterItems.forEach(function(e){
			e.checked = true;
			e.elm.classList.remove("inactive");
		});

		filter.filterElm.classList.remove("hasfilter");

		if (filter.onFilter){
			filter.onFilter(filter);
		}

	};

	me.buildMenu = function(){
		var container = document.getElementById("layers");
		var basecontainer = document.getElementById("baselayers");

		Config.baselayers.forEach(function(baselayer){
			var layerdiv = div(baselayer.id + (baselayer.active ? " active":""), baselayer.label || baselayer.id);
			layerdiv.dataset.url = baselayer.url;
			layerdiv.dataset.attribution = baselayer.attribution;
			baselayer.elm = layerdiv;
			layerdiv.item = baselayer;
			layerdiv.onclick=function(){
				Config.baselayers.forEach(function(item){
					item.elm.classList.remove("active");
					item.active = false;
				});
				layerdiv.classList.add("active");
				layerdiv.item.active = true;
				if (currentPopup) currentPopup.remove();
				MapService.setStyle(layerdiv.dataset.url, layerdiv.dataset.attribution);
				EventBus.trigger(EVENT.baseLayerChanged);
			};
			basecontainer.appendChild(layerdiv);
		});

		for (var key in Config.layers){
			if (Config.layers.hasOwnProperty(key)){
				var layer = Config.layers[key];
				if (layer.label){
					var layerContainer = div("layer");
					var label  = div("label","<i></i>" + layer.label);

					if (layer.display && layer.display.canToggle){
						label.className += " toggle";
						if (layer.display && !layer.display.visible) {
							label.className += " inactive";
							layerContainer.className += " inactive";
						}
						layer.labelElm = label;
						layer.containerElm = layerContainer;
						label.layer = layer;

						label.onclick = function(){
							UI.toggleLayer(this.layer);
						}
					}

					layerContainer.appendChild(label);

					if (layer.filters) layer.filters.forEach(function(filter){
						var filterContainer = div("filter");
						var filterLabel  = div("filterlabel",filter.label);
						var filterActiveIcon  = div("filteractive");
						filterActiveIcon.title = "Clear filter";

						filterActiveIcon.onclick = function(){
							me.clearFilter(filter);
						};

						filterContainer.appendChild(filterActiveIcon);
						filterContainer.appendChild(filterLabel);
						var itemContainer = div("items");

						var items = filter.items;
						if (typeof items === "function") items = filter.items();
						filter.layer = layer;
						filter.filterElm = filterContainer;

						var filterItems = [];
						var max = filter.maxVisibleItems;
						var hasOverflow = false;
						items.forEach(function(item,index){

							var filterItem = item;
							if (typeof item === "string" || typeof item === "number"){
								filterItem = {label: item}
							}
							filterItem.color = filterItem.color || "silver";
							if (typeof filterItem.value === "undefined") filterItem.value = filterItem.label;
							if (typeof filterItem.label === "undefined") filterItem.label = filterItem.value;

							var icon = '<i style="background-color: '+filterItem.color+'"></i>';
							var elm = div("filteritem",icon +  filterItem.label );

							elm.onclick = function(){me.updateFilter(filter,filterItem)};

							if (max && index>=max){
								elm.classList.add("overflow");
								hasOverflow = true;
							}

							itemContainer.appendChild(elm);

							filterItem.elm = elm;
							filterItem.checked = true;
							filterItems.push(filterItem);
						});
						filter.filterItems = filterItems;

						if (hasOverflow){
							var toggleMore = div("moreless","More ...");
							toggleMore.onclick = function(){
								if (itemContainer.classList.contains("expanded")){
									itemContainer.classList.remove("expanded");
									toggleMore.innerHTML = "More ...";
									toggleMore.classList.remove("less");
								}else{
									itemContainer.classList.add("expanded");
									toggleMore.innerHTML = "Less ...";
									toggleMore.classList.add("less");
								}
							};
							itemContainer.appendChild(toggleMore);
						}


						filterContainer.appendChild(itemContainer);
						layerContainer.appendChild(filterContainer);
					});

					container.appendChild(layerContainer);
				}
			}
		}
	};

	me.appendLayerFilters = function(layer,layerContainer){


		if (layerContainer.querySelector(".appended")){
			// filters aleady present - this happens on base layer switch
			return;
		}

		if (layer.filters) layer.filters.forEach(function(filter){

			var filterContainer = div("filter");

			var filterActiveIcon  = div("filteractive");
			filterActiveIcon.title = "Clear filter";

			filterActiveIcon.onclick = function(){
				me.clearFilter(filter);
			};

			var filterLabel  = div("filterlabel appended",filter.label);


			filterContainer.appendChild(filterActiveIcon);
			filterContainer.appendChild(filterLabel);
			var itemContainer = div("items");

			var items = filter.items;
			if (typeof items === "function") items = filter.items();
			filter.layer = layer;
			filter.filterElm = filterContainer;

			var filterItems = [];
			var max = filter.maxVisibleItems;
			var hasOverflow = false;
			items.forEach(function(item,index){

				var filterItem = item;
				if (typeof item === "string" || typeof item === "number"){
					filterItem = {label: item}
				}
				filterItem.color = filterItem.color || "silver";
				if (typeof filterItem.value === "undefined") filterItem.value = filterItem.label;

				var icon = '<i style="background-color: '+filterItem.color+'"></i>';
				var elm = div("filteritem",icon +  (filterItem.label || filterItem.value) );

				elm.onclick = function(){me.updateFilter(filter,filterItem)};

				if (max && index>=max){
					elm.classList.add("overflow");
					hasOverflow = true;
				}

				itemContainer.appendChild(elm);

				filterItem.elm = elm;
				filterItem.checked = true;
				filterItems.push(filterItem);
			});
			filter.filterItems = filterItems;

			if (hasOverflow){
				var toggleMore = div("moreless","Plus ...");
				toggleMore.onclick = function(){
					if (itemContainer.classList.contains("expanded")){
						itemContainer.classList.remove("expanded");
						toggleMore.innerHTML = "Plus ...";
						toggleMore.classList.remove("less");
					}else{
						itemContainer.classList.add("expanded");
						toggleMore.innerHTML = "Moins ...";
						toggleMore.classList.add("less");
					}
				};
				itemContainer.appendChild(toggleMore);
			}


			filterContainer.appendChild(itemContainer);
			layerContainer.appendChild(filterContainer);
		});
	};

	me.popup = function(data,template,point,flyTo){

		var html = data;
		if (template) html = Template.render(template,data);

		map.flyTo({center: point});

		if (currentPopup) currentPopup.remove();
		currentPopup = new mapboxgl.Popup()
			.setLngLat(point)
			.setHTML(html)
			.addTo(map);
	};

	me.activateDashboardTab = function(index,elm){

		currentDashBoardTab = index;

		var panel = document.querySelector(".dashboardtabs");
		var tabs = document.querySelector(".tabcontent");
		panel.querySelectorAll("div").forEach(function(tab){
			tab.classList.remove("active");
		});
		elm.classList.add("active");

		tabs.querySelectorAll(".tab").forEach(function(tab){
			tab.classList.add("hidden");
		});
		var tab = tabs.querySelector(".tab" + index);
		if (tab) tab.classList.remove("hidden");
	};




	me.initSearch = function(){

	};

	me.toggleSelect = function(){
		UI.select = !UI.select;
		var box = document.getElementById('selectbox');
		if (box) box.classList.toggle("active",UI.select);
		if (!UI.select && Config.onDeselect){
			Config.onDeselect();
		}
	};

	me.showDashboard = function(data,template){
		var delay = 0;
		if (!dashBoard){
			dashBoard = div();
			document.body.appendChild(dashBoard);
			dashBoard.outerHTML = Template.get("dashboard");
			dashBoard = document.getElementById("dashboard");

			var button = dashBoard.querySelector("button");
			button.onclick = me.hideDashboard;

			delay = 20;
		}

		setTimeout(function(){

			var html = data;
			if (template) {
				currentDashBoardTab = currentDashBoardTab || 1;
				for (var i = 1; i < 6; i++){
					data["tabButton" + i] =  currentDashBoardTab==i?"active":"";
					data["tabPanel" + i] =  currentDashBoardTab==i?"":"hidden";
				}

				html = Template.render(template,data);

				var clamp = Data.getYearClamp();
				if (clamp.start){
					var ys = Data.getYears();
					ys.forEach(function(year){
						if (year<clamp.start || year>clamp.end){
							html = html.replace(new RegExp("yeardisplay"+year, 'g'),"yeardisplay"+year + " contracted")
						}
					})
				}
			}

			var container = document.getElementById("dashboardcontent");
			container.innerHTML = html;


			dashBoard.className = "active";
			document.body.classList.add("dashboard");


			var image = container.querySelector(".image");
			if (image){
				image.onclick = function(){

					var lightBox = div();
					document.body.appendChild(lightBox);
					lightBox.outerHTML =  Template.render("lightbox",{url: image.dataset.url});
					lightBox = document.getElementById("lightbox");

					lightBox.onclick = function(){
						document.body.removeChild(lightBox);
					}
				}
			}

		},delay);

	};

	me.hideDashboard = function(){
		if (dashBoard){
			dashBoard.className = "";
			document.body.classList.remove("dashboard");
		}
	};

	me.togglePanel = function(elm){
		if (elm && elm.dataset.target){
			elm.classList.toggle("contracted");
			var container = elm.parentElement;
			var target = container.querySelector(elm.dataset.target);
			if (target){
				target.classList.toggle("contracted",elm.classList.contains("contracted"));
			}
		}
	};

	me.onRender = function(){
		if (currentLoader) removeLoader();
	};

	var removeLoader = function(){
		var loaderContainer = currentLoader.querySelector("i");
		if (loaderContainer) loaderContainer.innerHTML = "";
		currentLoader.classList.remove("loading");
		currentLoader = false;
	};



	return me;

}();
