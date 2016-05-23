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
  'jimu/BaseWidget',
  'dojo/on',
  'dojo/aspect',
  'dojo/string',
  'esri/SpatialReference',
  './ImageNode',
  'jimu/dijit/TileLayoutContainer',
  'jimu/utils',
  'libs/storejs/store'
],
function(declare, lang, array, html, BaseWidget, on, aspect, string,
  SpatialReference, ImageNode, TileLayoutContainer, utils, store) {
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

    //use this flag to control play button
    //play function work only in 3D map
    _canPlay: false,

    //the status can be: stop, playing, none
    _playStatus: 'none',

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

      if(this.appConfig.map['3D']){
        html.setStyle(this.btnPlay, 'display', '');
        aspect.after(this.map, 'onCameraChangeEnd', lang.hitch(this, this._onFlytoEnd), true);
        aspect.after(this.map, 'onCameraChangeBreak', lang.hitch(this, this._onFlytoBreak), true);
      }else{
        html.setStyle(this.btnPlay, 'display', 'none');
      }
      this.mapstateList.startup();

      this.own(on(this.mapstateName, 'keydown', lang.hitch(this, function(evt){
        var keyNum = evt.keyCode !== undefined ? evt.keyCode : evt.which;
        if (keyNum === 13) {
          this._onAddBtnClicked();
        }
      })));
    },

    onOpen: function(){
      // summary:
      //    see description in the BaseWidget
      // description:
      //    this function will the local cache if available
      var localBks = this._getLocalCache();
      if(localBks.length > 0){
        this.mapstates = localBks;
      }else{
        if(this.appConfig.map['3D']){
          this.mapstates = lang.clone(this.config.mapstates3D);
        }else{
          this.mapstates = lang.clone(this.config.mapstates2D);
        }
      }

      if(this.mapstates.length === 0){
        this._readMapstatesInWebmap();
      }
      this.displayMapstates();
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

    _switchPlayBtn: function(){
      if(this.mapstates.length > 1){
        html.removeClass(this.btnPlay, 'jimu-state-disabled');
        this._canPlay = true;
      }else{
        html.addClass(this.btnPlay, 'jimu-state-disabled');
        this._canPlay = false;
      }
    },

    _switchPlayStatus: function(status){
      this._playStatus = status;
      if(this._playStatus === 'none' || this._playStatus === 'stop'){
        this.btnPlay.innerHTML = utils.stripHTML(this.nls.labelPlay);
      }else{
        this.btnPlay.innerHTML = utils.stripHTML(this.nls.labelStop);
      }
    },

    _createMapstateNode: function(mapstate) {
      var thumbnail, node;

      if(mapstate.thumbnail){
        thumbnail = utils.processUrlInWidgetConfig(mapstate.thumbnail, this.folderUrl);
      }else{
        thumbnail = this.folderUrl + 'images/thumbnail_default.png';
      }

      node = new ImageNode({
        img: thumbnail,
        label: mapstate.displayName
      });
      on(node.domNode, 'click', lang.hitch(this, lang.partial(this._onMapstateClick, mapstate)));

      return node;
    },

    _getKeysKey: function(){
      // summary:
      //    we use className plus 2D/3D as the local storage key
      if(this.appConfig.map['3D']){
        return this.name + '.3D';
      }else{
        return this.name + '.2D';
      }
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

    _onFlytoEnd: function(/*jshint unused:false*/ camera){
      // summary:
      //    3D only.
      if(this._playStatus === 'stop' || this._playStatus === 'none'){
        return;
      }
      if(this.currentIndex + 1 === this.mapstateList.items.length){
        this._switchPlayStatus('stop');
        return;
      }
      this.currentIndex ++;
      this.mapstateList.items[this.currentIndex].highLight();
      setTimeout(lang.hitch(this, this._setCamera, this.mapstates[this.currentIndex]),
        this.config.stopTime);
    },

    _onFlytoBreak: function(){
      // summary:
      //    3D only.
      if(this._playStatus === 'playing'){
        this._switchPlayStatus('stop');
      }
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

    _onPlayBtnClicked: function(){
      if(!this._canPlay){
        return;
      }
      if(this._playStatus === 'playing'){
        this._switchPlayStatus('stop');
      }else{
        this._switchPlayStatus('playing');
        this.currentIndex = 0;
        this._switchDeleteBtn();
        this.mapstateList.items[this.currentIndex].highLight();
        this._setCamera(this.mapstates[this.currentIndex]);
      }
    },

    _createMapstate: function(){
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

    _onMapstateClick: function(mapstate) {
      // summary:
      //    set the map extent or camera, depends on it's 2D/3D map
      array.some(this.mapstates, function(b, i){
        if(b.displayName === mapstate.displayName){
          this.currentIndex = i;
          return true;
        }
      }, this);

      this._switchDeleteBtn();

      //require the module on demand
      if(this.appConfig.map['3D']){
        this._setCamera(mapstate);
      }else{
        require(['esri/geometry/Extent'], lang.hitch(this, function(Extent){
          var ext = mapstate.extent, sr;
          if(ext.spatialReference){
            sr = new SpatialReference(ext.spatialReference);
          }else{
            sr = new SpatialReference({ wkid:4326});
          }
          this.map.setExtent(new Extent(ext));
        }));
      }
    },

    _setCamera: function(mapstate){
      this.map.setCamera(mapstate.camera, this.config.flyTime);
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
    }

  });
});