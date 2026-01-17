// activity timer -->
let inactivityTimer = null;
const maxBuffer = 100;

function handleActivity() {
    // clear any existing timer 
    clearTimeout(inactivityTimer);

    // only start a new timer if there is "shit" in the buffer
    if (redBufferBucket > 0 || blueBufferBucket > 0) {
        inactivityTimer = setTimeout(() => {
            console.log("Inactivity sync triggered.");
            
            // check buffer again before firing because individually seperate
            if (redBufferBucket > 0) incRedServerPoll();
            if (blueBufferBucket > 0) incBlueServerPoll();

            // kill ref watchdog "goes to sleep"
            inactivityTimer = null;
        }, 2000);
    }
}

// making the function for the localized calls every 10 seconds. 

// don't think I need the interalId, so I am not keeping it
// var intervalId = window.setInterval(function(){

window.setInterval( () => {
    pollServerCounts()
}, 10000);

// === doc on load hook ===
// i am not using this rn -->
document.addEventListener('DOMContentLoaded', async () => {
// OR document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM has loaded!');    
    pollServerCounts() 
    // code...
});
// i am not using this rn -->

// doc elements for text field press counts
const redDisplay = document.getElementById("redValue")
const blueDisplay = document.getElementById("blueValue")

let redServerCount = 0;
let blueServerCount = 0;

async function pollServerCounts() {
    try {
        if (!redDisplay || !blueDisplay) {
            throw new Error("Required DOM elements not found");
        }

        const response = await fetch("/status");

        if (!response.ok) {
            throw new Error(`Polling sattus error: ${response.status}`);
        }

        const serverCounts = await response.json();
        
        // updating locally stored variables with that shown on the server
        redServerCount = serverCounts.countRed;
        blueServerCount = serverCounts.countBlue;

        // displaying results
        redDisplay.textContent = (redServerCount - totalRedBuffered) + redLocalCount;
        blueDisplay.textContent = (blueServerCount - totalBlueBuffered) + blueLocalCount;

    } catch (err) {
        console.error("Failed to query poll connect with server", err);
    }
}

// === doc on unload ===
// will alert the user when the window quits, need to see how this maps to relevant updates with batched data
// imagining a scenerio that can be test verified may be challanging
// i am thinking a local file write to update a number and quit
// something boop and bop. 

window.addEventListener('beforeunload', function (e) {
    // console.log('Window Quit!!'); 
    // Usage
    saveTestData();  
    incRedServerPoll();
    incBlueServerPoll();
    // e.preventDefault();
    // e.returnValue = '';
});

// and when the window is hidden

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        // Trigger one final sync when the user leaves the tab
        // saveTestData();  
        incRedServerPoll();
        incBlueServerPoll();
    }
});




// quick file writing test -->
async function saveTestData() {
    // this has no responce but there are ways to "keep it alive for error checks."
    // in this case it is so minimal I am going to break rules
    fetch('save-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    // it probably isn't worth handeling a response...?

    // const result = await response.json();
    // console.log(result.message);
}


// ~~ SERVER ZONE ~~
// this will actually buffer the data, the other is just for interactive display

let totalRedBuffered = 0;
let redBufferBucket = 0;

let totalBlueBuffered = 0;
let blueBufferBucket = 0;

let isRedSyncing = false;
let isBlueSyncing = false;

// refactor tips: it may be helpful to make this a function machine of sorts?

async function incRedServerPoll() {
    if (isRedSyncing) return;
    
    const ammountToSend = redBufferBucket;
    if (ammountToSend === 0) return;

    isRedSyncing = true;
    redBufferBucket = 0;
    
    try {
        const response = await fetch("/increment_red", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({'count': ammountToSend}),
        keepalive: true
    });
        if (!response.ok) {
            throw new Error(`Server status: ${response.status}`);
        }
        // SUCESS: no need to do anything, buffer is cleared. 
        totalRedBuffered += ammountToSend
        isRedSyncing = false;

    } catch (err) {
        console.error("Sync failed. Keeping counts in buffer.", err);

        // RECOVERY: put snapshot back so that it is included. 
        redBufferBucket += ammountToSend

        // trigger retry after 5
        setTimeout(() => {
            isRedSyncing = false;
            incRedServerPoll(); 
        }, 5000);
    }
}

async function incBlueServerPoll() {
    if (isBlueSyncing) return;

    const ammountToSend = blueBufferBucket
    if (ammountToSend === 0) return;

    isBlueSyncing = true;
    blueBufferBucket = 0;
    
    try {
        const response = await fetch("/increment_blue", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({'count': ammountToSend}),
        keepalive: true
    });
        if (!response.ok) {
            throw new Error(`Server status: ${response.status}`);
        }
        // SUCESS: no need to do anything, buffer is cleared. 
        totalBlueBuffered += ammountToSend
        isBlueSyncing = false;

    } catch (err) {
        console.error("Sync failed. Keeping counts in buffer.", err);

        // RECOVERY: put snapshot back so that it is included. 
        blueBufferBucket += ammountToSend

        // trigger retry after 5
        setTimeout(() => {
            isBlueSyncing = false;
            incBlueServerPoll(); 
        }, 5000);
    }
}
// ^~~ SERVER ZONE ~~^

// ~~ DINSPLAY ZONE ~~
// == red button clicks ===

// red button click actions
let redLocalCount = 0;
const redButton =  document.getElementById("redButton");

// redButton.addEventListener("click", async () => {

    // trying without async to keep it fluid:
redButton.addEventListener("click", () => {
    try {
        redLocalCount++;
        redBufferBucket++;
        redDisplay.textContent = (redServerCount - totalRedBuffered) + redLocalCount;

        // if max reached --> push and clear local buffer
        if (redBufferBucket > maxBuffer) {
            incRedServerPoll()
        }

        // inactive for 2 push the bucket and clear. 
        handleActivity()

    } catch (err) {
        console.error("Error incrementing red:", err);
    }
});

// == blue button clicks ===

// blue button click actions
let blueLocalCount = 0;
const blueButton =  document.getElementById("blueButton");

blueButton.addEventListener("click", () => {
    try {
        blueLocalCount++;
        blueBufferBucket++;
        blueDisplay.textContent = (blueServerCount - totalBlueBuffered) + blueLocalCount;

        if (blueBufferBucket >= maxBuffer) {
            incBlueServerPoll()
        }

        // inactive for 2 push the bucket and clear. 
        handleActivity()

    } catch (err) {
        console.error("Error incrementing blue:", err);
    }
});
// ^~~ DINSPLAY ZONE ~~^