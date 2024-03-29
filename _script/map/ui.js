var UI = function(){
	var me = {};

	var menuContainer;
	var currentPopup;
	var dashBoard;
	var currentDashBoardTab;
	var currentLoader;
	var infobox;
	var currentInfoBox;

	var languages ={
		en:{
			more: "More",
			less: "Less",
		},
		fr:{
			more: "Plus",
			less: "Moins",
		}
	}

	me.init = function(){
		menuContainer = menuContainer || document.getElementById("menu");
		menuContainer.innerHTML = Template.get("menu");
		menuContainer.className = "active";
		window.document.title = "IPIS Map " + (Config.mapName || Config.mapId || "");

		me.buildMenu();

		var closeListPanel = document.getElementById("closeListPanel");
		if (closeListPanel){
			closeListPanel.onclick = UI.hideListPanel;
		}

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

		if (firstUse && !Config.showDisclaimerAlways){
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

	me.showLayer = function(layer){
		var elm = layer.labelElm;
		var container = layer.containerElm;
		var wasVisible;

		if (layer.added) {
			wasVisible = map.getLayoutProperty(layer.id, 'visibility') !== "visible";
			map.setLayoutProperty(layer.id, 'visibility','visible');
		}else{
			if (elm){
				wasVisible = !elm.classList.contains("inactive");
				if (currentLoader) removeLoader();
				var loader = '<div class="lds-dual-ring"></div>';
				var loaderContainer = elm.querySelector("i");
				if (loaderContainer) loaderContainer.innerHTML = loader;
				elm.classList.add("loading");
				currentLoader = elm;
			}

			console.log("adding layer from story");
			MapService.addLayer(layer);
		}

		if (elm) elm.classList.remove("inactive");
		if (container) container.classList.remove("inactive");

		if (!wasVisible){
			console.log("Layer " + layer.id + " is toggled");
			if (layer.onToggle) layer.onToggle(!wasVisible);
			EventBus.trigger(EVENT.layerChanged);
		}

	};

	me.hideLayer = function(layer){
		var elm = layer.labelElm;
		var container = layer.containerElm;
		var wasVisible;

		if (layer.added) {
			wasVisible = map.getLayoutProperty(layer.id, 'visibility') !== "visible";
			map.setLayoutProperty(layer.id, 'visibility','none');
		}

		if (elm) elm.classList.add("inactive");
		if (container) container.classList.add("inactive");

		if (wasVisible){
			console.log("Layer " + layer.id + " is toggled");
			if (layer.onToggle) layer.onToggle(!wasVisible);
			EventBus.trigger(EVENT.layerChanged);
		}
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

	me.updateGroupFilter = function(filter,groupElm){

		var selectedCount = 0;
		var activeGroups = [];
		filter.filterGroups.forEach(function(group){
			if (!group.classList.contains("inactive")) selectedCount++;
		});

		if (selectedCount === filter.filterGroups.length){
			// select only the selected group
			filter.filterGroups.forEach(function(group){
				group.classList.add("inactive");
			});
			groupElm.classList.remove("inactive");
			activeGroups.push(groupElm.group);
		}else{
			groupElm.classList.toggle("inactive");
			filter.filterGroups.forEach(function(group){
				if (!group.classList.contains("inactive")) activeGroups.push(group.group);
			});
		}

		if (activeGroups.length === 0){
			me.clearFilter(filter);
		}else{
			var firstItem;
			filter.filterItems.forEach(function(e){
				if (activeGroups.indexOf(e.group)<0){
					e.checked = false;
					e.elm.classList.add("inactive");
				}else{
					e.checked = true;
					e.elm.classList.remove("inactive");
					firstItem = firstItem || e;
				}
			});

			if (firstItem){
				firstItem.checked=!firstItem.checked;
				me.updateFilter(filter,firstItem);
			}
		}


	};

	me.clearFilter = function(filter){

		filter.filterItems.forEach(function(e){
			e.checked = true;
			e.elm.classList.remove("inactive");
		});

		filter.filterElm.classList.remove("hasfilter");

		if (filter.filterGroups){
			filter.filterGroups.forEach(function(e){
				e.classList.remove("inactive");
			});
		}

		if (filter.onFilter){
			filter.onFilter(filter);
		}

	};

	me.updateFilterGroups = function(filter){
		if (filter.filterGroups){
			filter.filterGroups.forEach(function(group){
				var isActive = false;
				var items = group.querySelectorAll(".filteritem");
				for (var i=0; i<items.length; i++){
					var item = items[i];
					if (!item.classList.contains("inactive")) isActive=true;
				}
				if (isActive){
					group.classList.remove("inactive");
				}else{
					group.classList.add("inactive");
				}
			});
		}
	}

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


					if (layer.tooltip){
						var tooltip =  document.createElement("b");
						tooltip.className = "infodot";
						tooltip.id =  "tooltip" + layer.id;
						tooltip.value = layer.tooltip;
						tooltip.onclick = function(e){
							e.preventDefault();
							e.stopPropagation();
							UI.showInfobox(this,getTooltipContent(this.value),"left",layer.tooltipsize);
						}
						label.appendChild(tooltip);
					}

					layerContainer.appendChild(label);

					if (layer.filters) layer.filters.forEach(function(filter){
						var filterContainer = div("filter");
						var filterLabel  = div("filterlabel",filter.label);
						var filterActiveIcon  = div("filteractive");
						filterActiveIcon.title = "Clear filter";

						if (filter.tooltip){
							var tooltip =  document.createElement("b");
							tooltip.className = "infodot";
							tooltip.id =  "filtertooltip" + filter.id;
							tooltip.value =  filter.tooltip;
							tooltip.onclick = function(e){
								e.preventDefault();
								e.stopPropagation();
								UI.showInfobox(this,getTooltipContent(tooltip.value),"left",filter.tooltipsize);
							}
							filterLabel.appendChild(tooltip);
						}

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

							if (item.tooltip){
								var tooltip =  document.createElement("b");
								tooltip.className = "infodot";
								tooltip.id =  "filteritemtooltip" + filter.id + index;
								tooltip.value =  item.tooltip;
								tooltip.onclick = function(e){
									e.preventDefault();
									e.stopPropagation();
									UI.showInfobox(this,getTooltipContent(tooltip.value),"left",item.tooltipsize);
								}
								elm.appendChild(tooltip);
							}

							itemContainer.appendChild(elm);

							filterItem.elm = elm;
							filterItem.checked = true;
							filterItems.push(filterItem);
						});
						filter.filterItems = filterItems;

						if (hasOverflow){
							var toggleMore = div("moreless",getTranslation("more") + " ...");
							toggleMore.onclick = function(){
								if (itemContainer.classList.contains("expanded")){
									itemContainer.classList.remove("expanded");
									toggleMore.innerHTML = getTranslation("more") + " ...";
									toggleMore.classList.remove("less");
								}else{
									itemContainer.classList.add("expanded");
									toggleMore.innerHTML = getTranslation("less") + " ...";
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

			if (filter.tooltip){
				var tooltip =  document.createElement("i");
				tooltip.className = "infodot";
				tooltip.id =  filter.tooltip;
				tooltip.onclick = function(){
					UI.showInfobox(this);
				}
				filterLabel.appendChild(tooltip);
			}


			filterContainer.appendChild(filterActiveIcon);
			filterContainer.appendChild(filterLabel);
			var itemContainer = div("items");

			if (filter.columns === 2){
				itemContainer.classList.add("cols");
			}

			var items = filter.items;
			if (typeof items === "function") items = filter.items();
			filter.layer = layer;
			filter.filterElm = filterContainer;

			var filterItems = [];
			var groups = [];
			var filterItemsByGroup = {};
			var subContainer;
			var max = filter.maxVisibleItems;
			var hasOverflow = false;

			var itemGroup;
			if (filter.groupBy){
				var p = filter.groupBy;
				if (filter.groupBySort) p = filter.groupBySort;
				items.sort(function(a,b){return (a[p] > b[p]) ? 1 : ((b[p] > a[p]) ? -1 : 0)});


				// add one to make sure all children gets attached to its parent in the foreach loop
				items.push(undefined);
			}



			items.forEach(function(item,index){

				if (item){

					var parentContainer = itemContainer;
					var group;

					if (filter.groupBy){
						group = item[filter.groupBy];
						if (group !== itemGroup){
							itemGroup = group;
							var groupElm = div("filteritemgroup group" + groups.length);
							groupElm.group = group;
							groupElm.index = groups.length;
							var title =  div("filteritemgrouptitle");

							var toggleIcon = document.createElement("i");
							title.appendChild(toggleIcon);
							if (filter.groupByIcon){
								groupElm.classList.add(filter.id.toLowerCase() + groups.length);
								title.classList.add("double");
								title.innerHTML += "<b></b>";
							}
							title.innerHTML += group;

							groups.push(groupElm);

							subContainer =  div("sub");
							if (filter.groupByIcon) subContainer.classList.add("double")
							groupElm.appendChild(title);
							groupElm.appendChild(subContainer);
							itemContainer.appendChild(groupElm);
							filterItemsByGroup[group] = [];

							title.onclick = function(e){
								if (e.target.tagName.toLowerCase() === "i"){
									groupElm.classList.toggle("open");
								}else{
									groupElm.classList.add("open");
									me.updateGroupFilter(filter,groupElm);
								}


							}
						}
						parentContainer = subContainer || itemContainer;
					}

					var filterItem = item;
					if (typeof item === "string" || typeof item === "number"){
						filterItem = {label: item}
					}
					filterItem.color = filterItem.color || "silver";
					if (typeof filterItem.value === "undefined") filterItem.value = filterItem.label;
					if (typeof filterItem.label === "undefined") filterItem.label = filterItem.value;
					filterItem.group = group;
					filterItem.groupElm = groupElm;

					var icon = '<i style="background-color: '+filterItem.color+'"></i>';
					var elm = div("filteritem",icon +  (filterItem.label || filterItem.value) );

					elm.onclick = function(){
						me.updateFilter(filter,filterItem);

						if (filter.groupBy && filterItem.groupElm){
							me.updateFilterGroups(filter);
						}
					};

					if (max && index>=max){
						elm.classList.add("overflow");
						hasOverflow = true;
					}

					parentContainer.appendChild(elm);

					filterItem.elm = elm;
					filterItem.checked = true;
					filterItems.push(filterItem);
					if (group && filterItemsByGroup[group]) filterItemsByGroup[group].push(filterItem);
				}
			});
			filter.filterItems = filterItems;
			filter.filterGroups = groups;

			if (hasOverflow){
				var toggleMore = div("moreless",getTranslation("more") + " ...");
				toggleMore.onclick = function(){
					if (itemContainer.classList.contains("expanded")){
						itemContainer.classList.remove("expanded");
						toggleMore.innerHTML = getTranslation("more") + " ...";
						toggleMore.classList.remove("less");
					}else{
						itemContainer.classList.add("expanded");
						toggleMore.innerHTML = getTranslation("less") +  " ...";
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
		currentPopup = new mapboxgl.Popup({className: "clicked"})
			.setLngLat(point)
			.setHTML(html)
			.addTo(map);

		// fix blurry popups on non-retina screens
		var popup = currentPopup.getElement();
		if (popup){
			var w = Math.ceil(popup.clientWidth);
			if (w%2==1) w++;
			popup.style.width = w + "px";
		}

		window.currentPopup = currentPopup;
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


			var images = container.querySelectorAll(".image");
			for (var i = 0;i<images.length; i++){
					var image = images[i];
					image.onclick = function(){
						var lightBox = div();
						document.body.appendChild(lightBox);

						var urls = [];
						var slideshowIndex = 0;
						var slideshow = this.closest(".slideshow");
						if (slideshow){
							console.log("slideshow");
							var _images = slideshow.querySelectorAll(".image");
							for (var i = 0; i<_images.length; i++){
								var _url = _images[i].dataset.url;
								if (_url === this.dataset.url) slideshowIndex = i;
								urls.push({imageurl: _url});
							}
						}else{
							urls.push({imageurl: this.dataset.url});
						}

						urls[slideshowIndex].active = true;

						lightBox.outerHTML =  Template.render("lightbox",{
							count:  urls.length,
							index: slideshowIndex,
							hasPrev: slideshowIndex>0,
							hasNext: urls.length > slideshowIndex+1,
							images: urls
						});
						lightBox = document.getElementById("lightbox");



						lightBox.onclick = function(e){
							if (e.target.classList.contains("button")) return;
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

	function getTooltipContent(tooltip){
		var result = tooltip;

		if (tooltip && tooltip.indexOf("template.") === 0){
			var template = tooltip.substr(9);
			result = Template.get(template);
		}
		return result;
	}

	function slideOutLeft(image){
		image.classList.add("disappearleft");
		setTimeout(function(){
			image.classList.remove("disappearleft");
			image.classList.remove("active");
		},400);
	}
	function slideInRight(image){
		image.classList.add("isright");
		setTimeout(function(){
			image.classList.remove("isright");
			image.classList.add("active");
		},100);
	}
	function slideOutRight(image){
		image.classList.add("disappearright");
		setTimeout(function(){
			image.classList.remove("disappearright");
			image.classList.remove("active");
		},400);
	}
	function slideInLeft(image){
		image.classList.add("isleft");
		setTimeout(function(){
			image.classList.remove("isleft");
			image.classList.add("active");
		},100);
	}

	me.slideShow = function(elm,direction){
		var slideshow = elm.closest(".slideshow");
		var count = slideshow.dataset.count;
		var images = slideshow.querySelector(".images");
		var prev = slideshow.querySelector(".prev");
		var next = slideshow.querySelector(".next");

		if (images){
			var index = images.dataset.index || 0;
			index =  parseInt(index);
			if (isNaN(index)) index=0;
			var currentIndex = index;
			index += direction;
			if (index<0) index=count-1;
			if (index>count-1) index=0;
			images.dataset.index = index;
			if (slideshow.id === "lightbox"){
				var _images = images.querySelectorAll(".image");
				for (var i = 0; i<_images.length; i++){
					var image = _images[i];
					if (direction>0){
						if (i===index){
							slideInRight(image);
						}
						if (i===currentIndex){
							slideOutLeft(image);
						}
					}else{
						if (i===index){
							slideInLeft(image);
						}
						if (i===currentIndex){
							slideOutRight(image);
						}
					}
				}
			}else{
				images.style.left = "-" + (index*120) + "px";
			}

			prev.classList.toggle("active",index>0);
			next.classList.toggle("active",index<count-1);
		}
	}

	var listVisible = false;
	var currentListItem;
	me.showListPanel = function(item){

		document.getElementById("datalist").classList.remove("hidden");
		document.body.classList.add("listVisible");
		listVisible = true;
		EventBus.trigger(EVENT.UIResize);

		var container = document.getElementById("dataListContainer");
		var hasContent = container.querySelector(".entry");
		if (!hasContent){
			me.listLayer();
		}


		var element = document.getElementById("entry" + item.properties.id);
		if(element) {
			activateDashboardItem(element);
			var scroller = document.getElementById("dataListScroll");
			listSrollTo(scroller,element.offsetTop - 200,100);
		}


		EventBus.trigger(EVENT.UIResize);

	};

	me.hideListPanel = function(){
		document.getElementById("datalist").classList.add("hidden");
		document.body.classList.remove("listVisible");
		listVisible = false;
		EventBus.trigger(EVENT.UIResize);
		//if (dashBoard){
		//dashBoard.className = "";
		//document.body.classList.remove("dashboard");
		// }
	};

	var activateDashboardItem = function(item){
		var container = document.getElementById("dataListContainer");
		if (currentListItem) currentListItem.classList.remove("focused");
		currentListItem = item;
		item.classList.add("focused");
		container.classList.add("focused");
	};

	function listSrollTo(element, to, duration) {
		var start = element.scrollTop,
			change = to - start,
			currentTime = 0,
			increment = 20;

		var animateScroll = function(){
			currentTime += increment;
			element.scrollTop = Math.easeInOutQuad(currentTime, start, change, duration);
			if(currentTime < duration) {
				setTimeout(animateScroll, increment);
			}
		};
		animateScroll();
	}

	me.listLayer = function(silent){

		var container = document.getElementById("dataListContainer");
		container.innerHTML = "";
		//var layer = dataset[datasetId];
		var markers = Data.getIncidents(true);
		var table = document.createElement("div");
		for (var i = 0, len = markers.length; i<len; i++){
			var marker = markers[i];
			var co = marker.geometry.coordinates;

			var entry =  createListDataEntry(marker.properties);
			entry.setAttribute("data-co", co[1] + "|" + (parseFloat(co[0]) + 0.1));

			table.appendChild(entry);
		}
		container.appendChild(table);

		if (!silent){
			document.getElementById("datalist").classList.remove("hidden");
			document.body.classList.add("listVisible");
			listVisible = true;
			EventBus.trigger(EVENT.UIResize);
		}
	};

	function createListDataEntry(p){
		var actor = p.actor1;
		if (p.actor1Details) actor += " (" + p.actor1Details.trim() + ")";
		if (p.actor2) actor += "<br>" + p.actor2;
		if (p.actor2Details) actor += " (" + p.actor2Details.trim() + ")";
		if (p.actor3) actor += "<br>" + p.actor3;
		if (p.actor3Details) actor += " (" + p.actor3Details.trim() + ")";
		if (p.actor4) actor += "<br>" + p.actor4;
		if (p.actor4Details) actor += " (" + p.actor4Details.trim() + ")";

		var tr = document.createElement("div");
		tr.className = "entry";
		tr.id = "entry" + p.id;
		var td1 = document.createElement("div");
		td1.className = "date";
		td1.innerHTML = p.formattedDate;
		var td2 = document.createElement("div");
		td2.className = "actor";
		td2.innerHTML = actor;
		var td3 = document.createElement("div");
		td3.className = "description";
		td3.innerHTML = p.description;
		tr.appendChild(td1);
		tr.appendChild(td2);
		tr.appendChild(td3);

		var info = document.createElement("div");
		info.className = "info";
		info.innerHTML = "<b>Location:</b>" + p.location;
		tr.appendChild(info);

		tr.onclick=function(){
			activateDashboardItem(this);
			EventBus.trigger(EVENT.mapNavigate);

			var co = this.dataset["co"];
			var location = co.split('|');
			console.log(location);
			var point = [location[1],location[0]];
			map.flyTo({center: point,zoom:11});
		};

		return tr;

	}


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

	me.showInfobox = function(elm,text,position,size){
		var id = elm.id;
		position = position||"right";
		if (infobox){
			var doShow = (id!==currentInfoBox);
			me.hideInfobox();
			if (doShow){
				me.showInfobox(elm,text,position,size);
			}
		}else{
			text = text || id;
			if (text){
				infobox = document.createElement("div");
				infobox.className = "infobox";
				if (text.length>300) {
					infobox.className+= " large";
				}
				infobox.innerHTML = text;
				var co = offset(elm);
				infobox.style.top = co.top;

				if (position === "right"){
					infobox.style.left = co.left + 20;
					infobox.style.maxWidth = document.body.offsetWidth-(co.left + 20)-10;
				}

				if (position === "left"){
					infobox.style.top = co.top-10;
					infobox.style.right = "255px";

					if (size){
						infobox.style.width = size + "px";
						infobox.style.maxWidth = size + "px";
					}else{
						infobox.style.maxWidth = "250px";
					}

					infobox.classList.add("left");
					setTimeout(function(){
						infobox.classList.add("active");
					},10)
				}

				infobox.onclick = me.hideInfobox;
				document.body.appendChild(infobox);
				currentInfoBox = id;

			}
		}
	}

	me.hideInfobox = function(){
		if (infobox){
			infobox.remove();
			infobox = undefined;
			currentInfoBox=undefined;
		}
	}

	me.resetMap = function(){

		map.flyTo({
			center: [Config.initialMapCoordinates.x, Config.initialMapCoordinates.y],
			zoom: Config.initialMapCoordinates.zoom,
			pitch: 0,
			bearing: 0,
			essential: true // this animation is considered essential with respect to prefers-reduced-motion
		});
	}

	function offset(el) {
		var rect = el.getBoundingClientRect(),
			scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
			scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
	}

	//t = current time
	//b = start value
	//c = change in value
	//d = duration
	Math.easeInOutQuad = function (t, b, c, d) {
		t /= d/2;
		if (t < 1) return c/2*t*t + b;
		t--;
		return -c/2 * (t*(t-2) - 1) + b;
	};



	function getTranslation(s){
		var translations;
		if (Config && Config.language) translations = languages[Config.language];
		if (!translations) translations = languages.en;
		return translations[s] || s;
	}


	return me;

}();
