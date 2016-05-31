///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/_base/html',
  'dojo/json', 
  'jimu/BaseWidget',
  'jimu/portalUtils', 
  'dojo/on',
  'dojo/aspect',
  'dojo/string',
  'esri/SpatialReference',
  'esri/geometry/Extent',
  'esri/graphic', 
  'esri/layers/GraphicsLayer',
  './MapStateManager',  
  'jimu/LayerInfos/LayerInfos',
  './ImageNode',
  'jimu/dijit/TileLayoutContainer',
  'jimu/utils',
  'dojo/request/xhr', 
  'libs/storejs/store'
],
function(declare, lang, array, html, json, BaseWidget, portalUtils, on, aspect, string,
  SpatialReference, Extent, Graphic, GraphicsLayer, MapStateManager, LayerInfos, 
  ImageNode, TileLayoutContainer, utils, xhr, store) {
  return declare([BaseWidget], {
    //these two properties is defined in the BaseWidget
    baseClass: 'jimu-widget-mapstate',
    name: 'Mapstate',

    //mapStates: Object[]
    //    all of the map states, the format is the same as the config.json
    mapstates: [],

    //currentIndex: int
    //    the current selected mapstate index
    currentIndex: -1,

    //use this flag to control delete button
    _canDelete: false,
	
	constructor: function(options) {
		this.map = options.map; 
		this.storeStrategy = options.config.storeStrategy; 
		this.storeServiceUrl = options.config.storeServiceUrl; 
		this.layerInfosObj = null; 
		/* get the username */
		this.portal = portalUtils.getPortal(options.appConfig.portalUrl); 
		this.userName = this.portal.user.username; 
		/*username and webmap id to serve as a store key*/
		this.storeKey = this.userName + "_" + this.map.itemId; 
		this.MapStateManager = MapStateManager.getInstance(this.storeKey);
	}, 

    startup: function(){
      // summary:
      //    this function will be called when widget is started.
      // description:
      //    see dojo's dijit life cycle.
      this.inherited(arguments);

      this.mapstateList = new TileLayoutContainer({
        strategy: 'fixWidth',
        itemSize: {width: 100, height: 92}, //image size is: 100*60,
        hmargin: 15,
        vmargin: 5
      }, this.mapstateListNode);

      this.mapstateList.startup();

      this.own(on(this.mapstateName, 'keydown', lang.hitch(this, function(evt){
        var keyNum = evt.keyCode !== undefined ? evt.keyCode : evt.which;
        if (keyNum === 13) {
          this._onAddBtnClicked();
        }
      })));
    },
	
	  _addMapstate: function(stateData) {
		LayerInfos.getInstance(this.map, this.map.itemInfo)
		.then(lang.hitch(this, function(layerInfosObj) {
		  this.layerInfosObj = layerInfosObj;
		  if(stateData.extent || stateData.layers) {
			  this.mapstates.push(stateData); 

			  if(this.mapstates.length === 0){
				this._readMapstatesInWebmap();
			  }
			  this.displayMapstates();
		  }
		}));
	  }, 

    onOpen: function(){
      // summary:
      //    see description in the BaseWidget
      // description:
      //    this function will the local cache if available
	  if (this.storeStrategy === "remote") {
		  xhr(this._composeStoreURL("query"), {
			handleAs: "json",
			headers: {
			  "X-Requested-With": null
			}
		  }).then(lang.hitch(this, function(stateDataText) {
			  var stateData = json.parse(stateDataText, true);
			  // transform the state data 
			  var data = {}; 
			  var extent = stateData.map && stateData.map.extent;
			  if (extent) {
				data.extent = new Extent(
				  extent.xmin,
				  extent.ymin,
				  extent.xmax,
				  extent.ymax,
				  new SpatialReference(extent.spatialReference)
				);
			  }
			  var layers = stateData.map && stateData.map.layers;
			  if (layers) {
				data.layers = layers;
			  }
			  var graphicsLayers = stateData.map && stateData.map.graphicsLayers;
			  if (graphicsLayers) {
				data.graphicsLayers = graphicsLayers;
			  }
			  data.name = stateData.name;			  
			  data.updateDate = stateData.updateDate; 
			  //
			  this._addMapstate(data); 
		  }));
	  } else {
		  // by default, use local storage
		  this.MapStateManager.getMapState().then(lang.hitch(this, function(stateData) {
			  this._addMapstate(stateData); 
		  }));
	  }
    },

    onClose: function(){
      // summary:
      //    see description in the BaseWidget
      this.mapstates = [];
      this.currentIndex = -1;
    },

    onMinimize: function(){
      this.resize();
    },

    onMaximize: function(){
      this.resize();
    },

    resize: function(){
      if(this.mapstateList){
        this.mapstateList.resize();
      }
    },

    destroy: function(){
      this.mapstateList.destroy();
      this.inherited(arguments);
    },

    displayMapstates: function() {
      this._processDuplicateName(this.mapstates);

      // summary:
      //    remove all and then add
      var items = [];
      this.mapstateList.empty();
      array.forEach(this.mapstates, function(mapstate) {
        items.push(this._createMapstateNode(mapstate));
      }, this);

      this.mapstateList.addItems(items);
      this._switchDeleteBtn();
      this._switchPlayBtn();
      this.resize();
    },

    _readMapstatesInWebmap: function(){
      if(!this.map.itemInfo || !this.map.itemInfo.itemData ||
        !this.map.itemInfo.itemData.mapstates){
        return;
      }
      array.forEach(this.map.itemInfo.itemData.mapstates, function(mapstate){
        mapstate.isInWebmap = true;
        this.mapstates.push(mapstate);
      }, this);
    },

    _switchDeleteBtn: function(){
      if(this.currentIndex > -1 && !this.mapstates[this.currentIndex].isInWebmap){
        html.removeClass(this.btnDelete, 'jimu-state-disabled');
        this._canDelete = true;
      }else{
        html.addClass(this.btnDelete, 'jimu-state-disabled');
        this._canDelete = false;
      }
    },

    _createMapstateNode: function(mapstate) {
      var thumbnail, node;

      if(mapstate.thumbnail){
        thumbnail = utils.processUrlInWidgetConfig(mapstate.thumbnail, this.folderUrl);
      }else{
        thumbnail = this.folderUrl + 'images/thumbnail_us.png';
      }

      node = new ImageNode({
        img: thumbnail,
        label: mapstate.displayName + '<br/>' + mapstate.updateDate
      });
      on(node.domNode, 'click', lang.hitch(this, lang.partial(this._onMapstateClick, mapstate)));

      return node;
    },

    _getKeysKey: function(){
      // summary:
      //    we use className plus 2D as the local storage key
      return this.name + '.2D';
    },

    _saveAllToLocalCache: function() {
      // summary:
      //    if user add/delete a mapstate, we will save all of the mapstates into the local storage.

      var keys = [];
      //clear
      array.forEach(store.get(this._getKeysKey()), function(bName){
        store.remove(bName);
      }, this);

      array.forEach(this.mapstates, function(mapstate){
        var key = this._getKeysKey() + '.' + mapstate.displayName;
        keys.push(key);
        store.set(key, mapstate);
      }, this);

      store.set(this._getKeysKey(), keys);
    },

    _getLocalCache: function() {
      var ret = [];
      if(!store.get(this._getKeysKey())){
        return ret;
      }
      array.forEach(store.get(this._getKeysKey()), function(bName){
        if(bName.startWith(this._getKeysKey())){
          ret.push(store.get(bName));
        }
      }, this);
      return ret;
    },

    _onAddBtnClicked: function() {
      if (string.trim(this.mapstateName.value).length === 0) {
        html.setStyle(this.errorNode, {visibility: 'visible'});
        this.errorNode.innerHTML = utils.stripHTML(this.nls.errorNameNull);
        return;
      }

      this._createMapstate();

      html.setStyle(this.errorNode, {visibility: 'hidden'});
      this.errorNode.innerHTML = '&nbsp;';
      this.mapstateName.value = '';

      this.displayMapstates();
    },

	/*
	 * Need to capture the state from the current map (2D only)
	 * - extent (x)
	 * - visible layers 
	 * - drawing 
	 */
    _createMapstate: function(){
	/*
      var data, b;
      if(this.appConfig.map['3D']){
        data = this.map.getCamera(new SpatialReference(4326));
        b = {
          name: this.mapstateName.value,
          camera: [data.x, data.y, data.z, data.heading, data.tilt]
        };
      }else{
        b = {
          name: this.mapstateName.value,
          displayName: this.mapstateName.value,
          extent: this.map.extent.toJson()
        };
      }
      this.mapstates.push(b);
      this._saveAllToLocalCache();
	*/
	
	  LayerInfos.getInstance(this.map, this.map.itemInfo)
		.then(lang.hitch(this, function(layerInfosObj) {
		  this.layerInfosObj = layerInfosObj; 
		  if (this.storeStrategy === "remote") {
			  // transform the state data
			  var mapObj = {
				  mapId: this.map.itemId, 
				  extent: {
					xmin: this.map.extent.xmin,
					xmax: this.map.extent.xmax,
					ymin: this.map.extent.ymin,
					ymax: this.map.extent.ymax,
					spatialReference: {
					  wkid: this.map.extent.spatialReference.wkid,
					  wkt: this.map.extent.spatialReference.wkt
					}
				  },
				  layers: {}, 
				  graphicsLayers: {}
				};
				if (layerInfosObj && layerInfosObj.traversal) {
				  layerInfosObj.traversal(lang.hitch(this, function(layerInfo) {
					mapObj.layers[layerInfo.id] = {
					  visible: layerInfo.isVisible(), 
					  opacity: layerInfo.getOpacity(), 
					  layerDefinitions: layerInfo.layerObject.layerDefinitions
					};
				  }));
				}
				array.forEach(this.map.graphicsLayerIds, function(graphicsLayerId) {
					var graphicsLayer = this.map.getLayer(graphicsLayerId); 
					if (graphicsLayer.graphics && graphicsLayer.graphics.length > 0) {
						mapObj.graphicsLayers[graphicsLayerId] = []; 
						array.forEach(graphicsLayer.graphics, function(graphic) {
							mapObj.graphicsLayers[graphicsLayerId].push(graphic.toJson()); 
						}, this); 
					}
				}, this);
				var now = new Date();
				var stateData = {
				  name: this.mapstateName.value, 
				  updateDate: now.toLocaleString(), 
				  map: mapObj
				}; 
				var stateDataText = json.stringify(stateData); 
				// 
			    xhr(this._composeStoreURL("save"), {
				  method: "POST", 
				  handleAs: "json",
				  headers: {
				    "X-Requested-With": null
				  }, 
				  data: stateDataText
				}).then(lang.hitch(this, function(data) {
					console.log('response: ' + data); 
				}), lang.hitch(this, function(err) {
					console.log('error: ' + err); 
				})); 
		  } else {
			// by default, use local storage
			this.MapStateManager.saveMapState(this.map, this.layerInfosObj, this.mapstateName.value);
		  }
		})); 
	   
      this.resize();
    },
	
    _onDeleteBtnClicked: function(){

      if(!this._canDelete || this.currentIndex === -1){
        return;
      }

      array.some(this.mapstates, function(b, i){
        // jshint unused:false
        if(i === this.currentIndex){
          this.mapstates.splice(i, 1);
          return true;
        }
      }, this);

      this._saveAllToLocalCache();

      this.resize();

      this.currentIndex = -1;
      this.displayMapstates();
    },

	/*
	 * Need to apply the saved state to the current map (2D only)
	 * - extent (x)
	 * - visible layers 
	 * - drawing 
	 */
    _onMapstateClick: function(mapstate) {
      // summary:
      //    set the map extent
      array.some(this.mapstates, function(b, i){
        if(b.displayName === mapstate.displayName){
          this.currentIndex = i;
          return true;
        }
      }, this);

      this._switchDeleteBtn();

      //require the module on demand
      this._applyAppState(mapstate, this.map); 
    },

	  _applyAppState: function(stateData, map) {
		var layerData = stateData.layers;
		var graphicsData = stateData.graphicsLayers; 
		// no need to check the map itemId
		// - because the stateData is retrieved for a given map itemId
		// restore layer visibility
		this.layerInfosObj.restoreState({
		  layerOptions: layerData || null
		});
		// restore layer opacity
        array.forEach(this.layerInfosObj.getLayerInfoArray(), function(rootLayerInfo) {
		  rootLayerInfo.setOpacity(layerData[rootLayerInfo.id].opacity); 
        }, this);
		// restore layer definitions 
        array.forEach(this.layerInfosObj.getLayerInfoArray(), function(rootLayerInfo) {
		  // apply at the map service level
		  rootLayerInfo.setOpacity(layerData[rootLayerInfo.id].opacity); 
        }, this);		
		// restore the graphic layers
		for(var graphicsLayerId in graphicsData) {
			var graphicsLayer = map.getLayer(graphicsLayerId); 
			if (! graphicsLayer) {
				graphicsLayer = new GraphicsLayer({
					id: graphicsLayerId
				});
				map.addLayer(graphicsLayer);
			}
		    array.forEach(graphicsData[graphicsLayerId], function(graphicsJson) {
			    var graphic = new Graphic(graphicsJson);
			    graphicsLayer.add(graphic); 
		    }, this);
		}
		// restore map extent
		if (stateData.extent) {
		  map.setExtent(stateData.extent);
		}
		//this._publishMapEvent(map);
	  },

    _processDuplicateName: function(mapstates) {
      var mapstateArray = [];
      var nameHash = {};
      array.forEach(mapstates, function(mapstate) {
        var nameStr = mapstate.name;

        if (nameStr in nameHash) {
          nameHash[nameStr]++;
        } else {
          nameHash[nameStr] = 0;
        }

        if (nameHash[nameStr] > 0) {
          //suffix name(num) first
          var tmpDisplayName = nameStr + "(" + nameHash[nameStr] + ")";//like name(1)
          if (tmpDisplayName in nameHash) {
            nameHash[tmpDisplayName]++;
            nameHash[nameStr]++;
          } else {
            nameHash[tmpDisplayName] = 0;
          }

          if (nameHash[tmpDisplayName] > 0) {
            //type-in like "name(1)", turn to "name(2)"
            mapstate.displayName = nameStr + "(" + nameHash[nameStr] + ")";
          } else {
            //type-in like "name", turn to "name(num)"
            mapstate.displayName = tmpDisplayName;
          }
        } else {
          //no duplicateName
          mapstate.displayName = nameStr;
        }
        mapstateArray.push(mapstate);
      }, this);

      mapstates = mapstateArray;
    }, 
	
	_composeStoreURL: function(action) {
		return this.storeServiceUrl + "/" + action + "/" + this.userName + "/" + this.map.itemId; 
	}

  });
});