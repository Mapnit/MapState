///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
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
  'dojo/Deferred',
  'dojo/json',
  'esri/geometry/Extent',
  'esri/SpatialReference',
  'libs/storejs/store',
  'libs/md5/md5',
  'jimu/tokenUtils'
  ], function(declare, lang, array, Deferred, json, Extent,
    SpatialReference, storejs, md5js, TokenUtils) {
    var instance = null;
    var clazz = declare(null, {
      mapMd5: null,
      mapStateKey: null,

      _getMapStateMd5: function(map) {
        if (typeof this.mapMd5 === 'string') {
          return this.mapMd5;
        } else {
          var str = json.stringify(map);
          this.mapMd5 = md5js(str);
          return this.mapMd5;
        }
      },

      _getMapStateKey: function() {
        if (this.mapStateKey) {
          return this.mapStateKey;
        }

        // xt or integration use id of app as key,
        // deploy app use pathname as key
        this.mapStateKey = 'mapstate_' +  this.token || window.path;
        return this.mapStateKey;
      },

      getMapState: function() {
        var def = new Deferred();
        var data = {};
        var mapStateKey = this._getMapStateKey();

        var mapState = storejs.get(mapStateKey);
        if (mapState && mapState.mapStateMd5 === this._getMapStateMd5()){
          var extent = mapState.map && mapState.map.extent;
          if (extent) {
            data.extent = new Extent(
              extent.xmin,
              extent.ymin,
              extent.xmax,
              extent.ymax,
              new SpatialReference(extent.spatialReference)
            );
          }
          var layers = mapState.map && mapState.map.layers;
          if (layers) {
            data.layers = layers;
          }
		  var graphicsLayers = mapState.map && mapState.map.graphicsLayers;
		  if (graphicsLayers) {
            data.graphicsLayers = graphicsLayers;
          }
		  data.name = mapState.name;
		  
		  data.updateDate = mapState.updateDate; 
        } else {
          storejs.remove(mapStateKey);
        }

        def.resolve(data);

        return def;
      },

      saveMapState: function(map, layerInfosObj, mapstateName) {
        if (!map) {
          return;
        }

        var key = this._getMapStateKey();
        var mapObj = {
		  mapId: map.itemId, 
          extent: {
            xmin: map.extent.xmin,
            xmax: map.extent.xmax,
            ymin: map.extent.ymin,
            ymax: map.extent.ymax,
            spatialReference: {
              wkid: map.extent.spatialReference.wkid,
              wkt: map.extent.spatialReference.wkt
            }
          },
          layers: {}, 
		  graphicsLayers: {}
        };
        if (layerInfosObj && layerInfosObj.traversal) {
          layerInfosObj.traversal(lang.hitch(this, function(layerInfo) {
            mapObj.layers[layerInfo.id] = {
              visible: layerInfo.isVisible(), 
			  opacity: layerInfo.getOpacity()
            };
          }));
        }
		array.forEach(map.graphicsLayerIds, function(graphicsLayerId) {
			var graphicsLayer = map.getLayer(graphicsLayerId); 
			if (graphicsLayer.graphics && graphicsLayer.graphics.length > 0) {
				mapObj.graphicsLayers[graphicsLayerId] = []; 
				array.forEach(graphicsLayer.graphics, function(graphic) {
					mapObj.graphicsLayers[graphicsLayerId].push(graphic.toJson()); 
				}, this); 
			}
		}, this);
		var now = new Date();
        storejs.set(key, {
		  name: mapstateName, 
		  updateDate: now.toLocaleString(), 
          map: mapObj,
          mapStateMd5: this._getMapStateMd5()
        });
      }
    });

    clazz.getInstance = function(token) {
      if (instance === null) {
        instance = new clazz();
      }
      instance.token = token;
      return instance;
    };

    return clazz;
  });