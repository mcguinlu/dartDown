// Handle parameter changes
const urlParams = window.location.search
  .substring(1)
  .split('&')
  .reduce((params, urlParam) => {
    let param = urlParam.split('=');
    params[param[0]] = param[1];
    return params;
  }, {});

// number of trains to display in either direction
const MAX_TRAINS_PER_DIRECTION = parseInt(urlParams.limit) || 3;
// station of origin abbreviation - https://api.bart.gov/docs/overview/abbrev.aspx
const STATION_CODE = urlParams.station || 'gcdk';
// departure times below the cutoff will not be displayed
const MINUTE_CUTOFF = parseInt(urlParams.minute_cutoff) || 3;
// How often to poll for updates
const UPDATE_MS = parseInt(urlParams.refresh)*1000 || 60000;

// Scale content
const fontWidth = 100 / (MAX_TRAINS_PER_DIRECTION * 1.5);
document.body.style.fontSize = `${fontWidth}vw`;

async function dartDown() {

  console.log('dartDown');

  const response = await fetch(
    `https://api.factmaven.com/xml-to-json/?xml=http://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML?StationCode=${STATION_CODE}`,
  );

  const data = await response.json();

  // Check if API has returned any trains
  trains_available = data.hasOwnProperty('ArrayOfObjStationData');

  
  const estimatesForStation = data.ArrayOfObjStationData.objStationData

  const estimates = estimatesForStation
    // Filter estimates that don't match criteria
    .filter((estimate) => estimate.Duein >= MINUTE_CUTOFF) // Keep trains that are due in less than the cutoff
    .filter((estimate) => estimate.Traintype == 'DART') // Keep only DART trains
    // Transform 'Leaving' to 00 and ensure all times are double digits
    .map((estimate) => {
      estimate.Duein = estimate.Duein === 'Leaving' ? '00' : estimate.Duein;
      estimate.Duein = estimate.Duein.length < 2 ? '0' + estimate.Duein : estimate.Duein;
      return estimate;
    })
    // Sort departures from soonest to latest
    .sort((a, b) => a.Duein - b.Duein);

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
          `<div class="estimate ${estimate.Destination.toLowerCase()}">${estimate.Duein}</div>`,
        );

      directionCount[direction]++;
    }
  });
}

// Display an icon on error
function displayErrorState(error) {
  console.log(error);

  // If API is showing no trains, say that
  // Otherwise, show disonnected symbol on error
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
