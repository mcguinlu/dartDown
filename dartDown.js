// Handle parameter changes
const urlParams = new URLSearchParams(window.location.search);

// number of trains to display in either direction
const MAX_TRAINS_PER_DIRECTION = parseInt(urlParams.get('limit')) || 3;
// station of origin abbreviation - https://api.bart.gov/docs/overview/abbrev.aspx
const STATION_CODE = urlParams.get('station') || 'gcdk';
// departure times below the cutoff will not be displayed
const MINUTE_CUTOFF = parseInt(urlParams.get('minute_cutoff')) || 3;
// How often to poll for updates
const UPDATE_MS = parseInt(urlParams.get('refresh')) * 1000 || 180000;

// Scale content
const fontWidth = 100 / (MAX_TRAINS_PER_DIRECTION * 1.5);
document.body.style.fontSize = `${fontWidth}vw`;

async function dartDown() {
  console.log('dartDown');

  var origin = window.location.protocol + '//' + window.location.host;

  try {
    const response = await fetch(
      'https://corsproxy.io/?' +
      `https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML?StationCode=${STATION_CODE}`
    );

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');



    // Extracting data from XML
    const estimatesForStation = Array.from(xmlDoc.querySelectorAll('objStationData')).map((estimate) => {
      return Array.from(estimate.children).reduce((obj, child) => {
        obj[child.nodeName] = child.textContent.trim();
        return obj;
      }, {});
    });

    // Filter and process estimates
    const estimates = estimatesForStation
      .filter((estimate) => parseInt(estimate.Duein) >= MINUTE_CUTOFF) // Keep trains that are due in less than the cutoff
      .filter((estimate) => estimate.Traintype === 'DART') // Keep only DART trains
      .map((estimate) => {
        estimate.Duein = estimate.Duein === 'Leaving' ? '00' : estimate.Duein;
        estimate.Duein = estimate.Duein.length < 2 ? '0' + estimate.Duein : estimate.Duein;
        return estimate;
      })
      .sort((a, b) => parseInt(a.Duein) - parseInt(b.Duein));

    // Hide the error state
    document.getElementById('disconnected').style.display = 'none';

    // Remove existing estimates from DOM
    Array.from(document.getElementsByClassName('estimate')).forEach((line) => {
      line.remove();
    });

    let directionCount = {
      northbound: 0,
      southbound: 0,
    };

    // Add the new estimates to the DOM
    estimates.forEach((estimate) => {
      const direction = estimate.Direction.toLowerCase();
      if (directionCount[direction] < MAX_TRAINS_PER_DIRECTION) {
        document
          .getElementById(direction)
          .insertAdjacentHTML(
            'beforeEnd',
            `<div class="estimate ${estimate.Destination.toLowerCase()}">${estimate.Duein}</div>`
          );

        directionCount[direction]++;
      }
    });
  } catch (error) {
    displayErrorState(error);
  }
}

// Display an icon on error
function displayErrorState(error) {
  console.log(error);

  // If API is showing no trains, say that
  // Otherwise, show disconnected symbol on error
  if (trains_available) {
    document.getElementById('disconnected').style.display = 'flex';
  } else {
    document.getElementById('no-trains').style.display = 'flex';
    document.getElementById('no-trains').style.fontSize = `${fontWidth}vw`;
  }
}

// Kick it off!
dartDown().catch(displayErrorState);

// Set up recurring call
setInterval(() => {
  dartDown().catch(displayErrorState);
}, UPDATE_MS);
