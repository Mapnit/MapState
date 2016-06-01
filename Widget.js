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
		if (this.map.itemInfo && this.map.itemInfo.item) {
			this.mapName = options.map.itemInfo.item.title; 
		} else {
			this.mapName = "this webmap"; 
		}
		this.storeStrategy = options.config.storeStrategy; 
		this.storeServiceUrl = options.config.storeServiceUrl; 
		this.layerInfosObj = null; 
		/* get the username */
		this.portal = portalUtils.getPortal(options.appConfig.portalUrl); 
		this.userName = this.portal.user.username; 
		/*username and webmap id to serve as a store key*/
		this.storeKey = this.userName + "_" + this.map.itemId; 
		/* pre-set the map state name */
		this.mapstateName = {value: "mapstate"}; 
		this.MapStateManager = MapStateManager.getInstance(this.storeKey);
	}, 
	
	  _addMapstate: function(stateData) {
		LayerInfos.getInstance(this.map, this.map.itemInfo)
		.then(lang.hitch(this, function(layerInfosObj) {
		  this.layerInfosObj = layerInfosObj;
		  if(stateData.extent || stateData.layers) {
			  this.mapstates = []; 
			  this.mapstates.push(stateData); 
			  this.currentIndex = 0; 

			  if(this.mapstates.length === 0){
				this._readMapstatesInWebmap();
			  }
			  this.displayMapstates();
			  this._switchDeleteBtn(); 
		  } else {
			  var msgText = utils.stripHTML(this.nls.errorNameEmpty); 
			  msgText = msgText.replace("%mapName%", this.mapName); 
			  this.mapstateMsgNode.innerHTML = msgText; 

			  this._switchDeleteBtn(); 
			  this.currentIndex = -1; 
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
			  var data = this.MapStateManager._prepareMapState(stateData); 
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

    displayMapstates: function() {
      this._processDuplicateName(this.mapstates);
	  // display the map status status 
	  if (this.mapstates && this.mapstates.length > 0) {
		  // take the 1st one (assume only one be saved)
		  var mapstate = this.mapstates[0];
		  var msgText = utils.stripHTML(this.nls.msgStateStatus); 
		  msgText = msgText.replace("%date%", mapstate.updateDate); 
		  this.mapstateMsgNode.innerHTML = msgText; 
	  }	else {
		  var msgText = utils.stripHTML(this.nls.errorNameEmpty); 
		  msgText = msgText.replace("%mapName%", this.mapName); 
		  this.mapstateMsgNode.innerHTML = msgText; 
	  }
	  // 
      //this._switchDeleteBtn();
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
      if(this.currentIndex > -1){
        html.removeClass(this.btnDelete, 'jimu-state-disabled');
        this._canDelete = true;
      }else{
        html.addClass(this.btnDelete, 'jimu-state-disabled');
        this._canDelete = false;
      }
    },

    _onSaveBtnClicked: function() {
      if (string.trim(this.mapstateName.value).length === 0) {
        html.setStyle(this.errorNode, {visibility: 'visible'});
        this.errorNode.innerHTML = utils.stripHTML(this.nls.errorNameEmpty);
        return;
      }

      this._createMapstate();

      html.setStyle(this.errorNode, {visibility: 'hidden'});
      this.errorNode.innerHTML = '&nbsp;';

	  var msgText = utils.stripHTML(this.nls.msgSaveSuccess); 
	  msgText = msgText.replace("%mapName%", this.mapName); 
	  this.mapstateMsgNode.innerHTML = msgText; 
    },

	/*
	 * Need to capture the state from the current map (2D only)
	 * - extent (x)
	 * - visible layers 
	 * - drawing 
	 */
    _createMapstate: function(){	
	  LayerInfos.getInstance(this.map, this.map.itemInfo)
		.then(lang.hitch(this, function(layerInfosObj) {
		  this.layerInfosObj = layerInfosObj; 
		  if (this.storeStrategy === "remote") {
			// transform the state data
			var stateData = this.MapStateManager._extractMapState(
				this.map, this.layerInfosObj, this.mapstateName.value); 
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
			  var msgText = utils.stripHTML(this.nls.msgSaveSuccess); 
			  msgText = msgText.replace("%mapName%", this.mapName); 
			  this.mapstateMsgNode.innerHTML = msgText; 
			  // refresh the mapstates variable
			  this.onOpen();
			  // 
			}), lang.hitch(this, function(err) {
			  var msgText = utils.stripHTML(this.nls.errSaveFailure); 
			  msgText = msgText.replace("%mapName%", this.mapName); 
			  this.mapstateMsgNode.innerHTML = msgText; 
			})); 
		  } else {
			// by default, use local storage
			this.MapStateManager.saveMapState(
				this.map, this.layerInfosObj, this.mapstateName.value);
			// refresh the mapstates variable
			this.onOpen();
			// 			
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

      this.MapStateManager.deleteMapState(); 

      this.resize();

      this.currentIndex = -1;
	  this._switchDeleteBtn(); 
	  
      this.displayMapstates();	  

	  var msgText = utils.stripHTML(this.nls.msgDeleteSuccess); 
	  msgText = msgText.replace("%mapName%", this.mapName); 
	  this.mapstateMsgNode.innerHTML = msgText; 	  
    },
	
	_onRestoreBtnClicked: function() {
		console.log("restore to the default view"); 
		// Reload the current page
		location.reload();
	}, 
	
	_onLoadBtnClicked: function() {
		if (this.mapstates && this.mapstates.length > 0) {
			// take the 1st one (assume only one be saved)
			var mapstate = this.mapstates[0];
			//require the module on demand
			this._applyAppState(mapstate, this.map); 
			// 
			var msgText = utils.stripHTML(this.nls.msgLoadSuccess); 
		    msgText = msgText.replace("%mapName%", this.mapName); 
		    this.mapstateMsgNode.innerHTML = msgText; 
		}
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

      //this._switchDeleteBtn();

      //require the module on demand
      this._applyAppState(mapstate, this.map); 
    },

	  _applyAppState: function(stateData, map) {
		var layerData = stateData.layers;
		var graphicsData = stateData.graphicsLayers; 
		// no need to check the map itemId
		// - because the stateData is retrieved for a given map itemId
		// set layer visibility
		this.layerInfosObj.restoreState({
		  layerOptions: layerData || null
		});
		// set layer opacity
        array.forEach(this.layerInfosObj.getLayerInfoArray(), function(rootLayerInfo) {
		  rootLayerInfo.setOpacity(layerData[rootLayerInfo.id].opacity); 
        }, this);
		// set layer definitions 
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
		// set map extent
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
		return this.storeServiceUrl + "/" + action 
			+ "/" + this.userName + "/" + this.map.itemId; 
	}

  });
});