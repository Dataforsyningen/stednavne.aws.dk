"use strict";

var kort= require('dawa-kort')
  , dawalautocomplete= require('./dawa-leaflet-autocomplete.js')
 // , dawalgrafik= require('./dawa-leaflet-grafik.js')
  , dawautil= require('dawa-util')
  , URLSearchParams = require('url-search-params')  
  , dawaois= require('./dawa-ois-koder.js');

var map;

var options= {
  contextmenu: true,
  contextmenuWidth: 140,
  contextmenuItems: [
  // {
  //   text: 'Koordinater?',
  //   callback: visKoordinater
  // },
  {
    text: 'Adgangsadresse?',
    callback: nærmesteAdgangsadresse
  },
  {
    text: 'Bygning?',
    callback: nærmesteBygning
  },
  {
    text: 'Vej?',
    callback: nærmesteVejstykke
  },
  {
    text: 'Hvor?',
    callback: hvor
  }
  // {
  //   text: 'Kommune?',
  //   callback: visKommune
  // }, '-',{
  //   text: 'Centrer kort her',
  //   callback: centerMap
  // }
  ]
};

function main() { 
  fetch('/getticket').then(function (response) {
    response.text().then(function (ticket) {      
      map= kort.viskort('map', ticket, options);
      dawalautocomplete.search().addTo(map);
      var center= kort.beregnCenter();
      map.setView(center,2);
    });
  });  
}

main();

function nærmesteAdgangsadresse(e) {
  fetch(dawautil.danUrl("https://dawa.aws.dk/adgangsadresser/reverse",{struktur: 'mini', x: e.latlng.lng, y: e.latlng.lat, medtagugyldige: true}))
  .catch(function (error) {
    alert(error.message);
  })
  .then(function(response) {
    if (response.status >=400 && response.status <= 499) {
      response.json().then(function (object) {
        alert(object.type + ': ' + object.title);
      });
    }
    else if (response.status >= 200 && response.status <=299 ){
      return response.json();
    }
  }) 
  .then( function ( adgangsadresse ) { 
    var marker= L.circleMarker(L.latLng(adgangsadresse.y, adgangsadresse.x), {color: 'red', fillColor: 'red', stroke: true, fillOpacity: 1.0, radius: 4, weight: 2, opacity: 1.0}).addTo(map);//defaultpointstyle);
    var popup= marker.bindPopup(L.popup().setContent("<a target='_blank' href='https://dawa.aws.dk/adgangsadresser?id="+adgangsadresse.id+"'>" + dawautil.formatAdgangsadresse(adgangsadresse) + "</a>"),{autoPan: true});
    
    map.setView(L.latLng(adgangsadresse.y, adgangsadresse.x),12);
    popup.openPopup();
  });
}


function nærmesteBygning(e) {
  var params = new URLSearchParams();
  params.set('format','json');
  params.set('x', e.latlng.lng);
  params.set('y', e.latlng.lat);
  params.set('medtagugyldige', true);
  var url= '/oisbygninger?'+params.toString();
  fetch(url)
  .catch(function (error) {
    alert(error.message);
  })
  .then(function(response) {
    if (response.status >=400 && response.status <= 499) {
      response.text().then(function (text) {
        alert(text);
      });
    }
    else if (response.status >= 200 && response.status <=299 ){
      return response.json();
    }
  }) 
  .then( function ( bygninger ) {
    var bygning= bygninger[0];
    var punkt=  L.latLng(bygning.bygningspunkt.koordinater[1], bygning.bygningspunkt.koordinater[0]);
    var marker= L.circleMarker(punkt, {color: 'blue', fillColor: 'blue', stroke: true, fillOpacity: 1.0, radius: 4, weight: 2, opacity: 1.0}).addTo(map);//defaultpointstyle);
    var popup= marker.bindPopup(L.popup().setContent("<a target='_blank' href='" + url + "'>" + dawaois.anvendelseskoder[bygning.BYG_ANVEND_KODE] + " fra " + bygning.OPFOERELSE_AAR + "</a>"),{autoPan: true});
    
    map.setView(punkt,12);
    popup.openPopup();
  //  map.fitBounds(geojsonlayer.getBounds());
  });
}

function nærmesteVejstykke(e) {
  fetch(dawautil.danUrl("https://dawa.aws.dk/vejstykker/reverse",{format: 'geojson', x: e.latlng.lng, y: e.latlng.lat}))
  .catch(function (error) {
    alert(error.message);
  })
  .then(function(response) {
    if (response.status >=400 && response.status <= 499) {
      response.json().then(function (object) {
        alert(object.type + ': ' + object.title);
      });
    }
    else if (response.status >= 200 && response.status <=299 ){
      return response.json();
    }
  }) 
  .then( function ( vejstykke ) { 
    var layer= L.geoJSON(vejstykke).addTo(map);
    var popup= layer.bindPopup("<a target='_blank' href='https://dawa.aws.dk/vejstykker?kode="+vejstykke.properties.kode+"&kommunekode="+vejstykke.properties.kommunekode+"'>" + vejstykke.properties.navn + " (" + vejstykke.properties.kode + ")" + "</a>");
    popup.openPopup();
  });
}

function hvor(e) {
    var antal= 0;
    var promises= [];

    // jordstykke
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/jordstykker/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatjordstykke;
    antal++;

    // sogn
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/sogne/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Sogn", 'sogne');
    antal++;

    // postnummer
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/postnumre/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatpostnummer;
    antal++;

    // bebyggelser
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/bebyggelser",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatbebyggelse;
    antal++;

    // kommune
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/kommuner/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Kommune", 'kommuner');
    antal++;

    // region
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/regioner/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Region",'regioner');
    antal++;

    // retskreds
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/retskredse/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Retskreds", 'retskredse');
    antal++;

    // politikreds
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/politikredse/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Politikreds", 'politikredse');
    antal++;

    // opstillingskreds
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/opstillingskredse/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatdata("Opstillingskreds", 'opstillingskredse');
    antal++;

    // storkreds
    promises.push(fetch(dawautil.danUrl("https://dawa.aws.dk/storkredse/reverse",{x: e.latlng.lng, y: e.latlng.lat})));
    promises[antal].format= formatstorkreds;
    antal++;

    Promise.all(promises) 
    .catch(function (error) {
      alert(error.message);
    })
    .then(function(responses) {
      for(let i= 0; i<responses.length; i++) {
        responses[i]= responses[i].json();
      }
      return Promise.all(responses);
    })
    .then(function(data) {
      let tekst= '<small><ul>';
      for(let i=0; i<data.length; i++) {
        tekst= tekst + promises[i].format(data[i]);
      } 
      tekst= tekst + "</ul></small>";     
      var punkt=  e.latlng;
      var popup = L.popup()
      .setLatLng(punkt)
      .setContent(tekst)
      .openOn(map);
    });
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function formatpostnummer(data) {
    return "<li>Postnummer: <a target='_blank' href='https://dawa.aws.dk/postnumre/"+data.nr+"'>" +  data.nr + " " + data.navn + "</a></li>";
  }
  function formatstorkreds(data) {
    return "<li>Storkreds: <a target='_blank' href='https://dawa.aws.dk/storkredse/"+data.nummer+"'>" + data.navn + " (" + data.nummer + ")" + "</a></li>";
  }

  function formatjordstykke(data) {
    return "<li>Jordstykke: <a target='_blank' href='https://dawa.aws.dk/jordstykker/"+data.ejerlav.kode+"/"+data.matrikelnr+"'>" + (data.ejerlav.navn?data.ejerlav.navn+" ":"") + data.ejerlav.kode + " " +data.matrikelnr + "</a></li>";
  }

  function formatbebyggelse(data) {
    let tekst= '';
    for (var i= 0; i<data.length;i++) {
      tekst= tekst + "<li>" + capitalizeFirstLetter(data[i].type)+": <a target='_blank' href='https://dawa.aws.dk/bebyggelser/"+data[i].id+"'>" + data[i].navn + "</a></li>";
    }
    return tekst;
  }

  function formatdata(titel,id) {
    return function (data) { return "<li>" + titel + ": <a target='_blank' href='https://dawa.aws.dk/"+id+"/"+data.kode+"'>" + data.navn + " (" + data.kode + ")" + "</a></li>"};
  }

