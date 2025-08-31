// iCal feed configuration
const ICAL_URL = 'https://calendar.google.com/calendar/ical/cfcd271fee27601a0ac1a031ab858d3eec689d81206d50880596bb24eb1ecf89%40group.calendar.google.com/public/basic.ics';

// Function to parse iCal data
function parseICalData(icalData) {
    console.log('Parsing iCal data...');
    const events = [];
    const lines = icalData.split(/\r?\n/);
    let currentEvent = null;
    let multiLineValue = '';
    let multiLineKey = '';
    
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const lineTrimmed = rawLine.trim();
        // Handle multi-line folded values (lines starting with space or tab)
        if (rawLine.startsWith(' ') || rawLine.startsWith('\t')) {
            multiLineValue += rawLine.substring(1);
            continue;
        } else if (multiLineValue && multiLineKey) {
            processEventProperty(currentEvent, multiLineKey, multiLineValue);
            multiLineValue = '';
            multiLineKey = '';
        }
        if (lineTrimmed === 'BEGIN:VEVENT') {
            currentEvent = {};
        } else if (lineTrimmed === 'END:VEVENT' && currentEvent) {
            // Filter for events >= today and < today + 90 days
            const now = new Date();
            now.setHours(0,0,0,0);
            const maxDate = new Date(now);
            maxDate.setDate(maxDate.getDate() + 90);
            let eventStart = currentEvent.start ? new Date(currentEvent.start) : null;
            if (eventStart && currentEvent.isAllDay) {
                eventStart.setHours(0,0,0,0);
            }
            if (eventStart && eventStart >= now && eventStart < maxDate) {
                events.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent && rawLine.includes(':')) {
            const colonIndex = rawLine.indexOf(':');
            const key = rawLine.substring(0, colonIndex);
            const value = rawLine.substring(colonIndex + 1);
            if (value && (key.startsWith('DESCRIPTION') || key === 'SUMMARY')) {
                multiLineKey = key.split(';')[0];
                multiLineValue = value;
            } else {
                processEventProperty(currentEvent, key, value);
            }
        }
    }
    if (multiLineValue && multiLineKey && currentEvent) {
        processEventProperty(currentEvent, multiLineKey, multiLineValue);
    }
    events.sort((a, b) => new Date(a.start) - new Date(b.start));
    return events;
}

// Helper function to process event properties
function processEventProperty(event, key, value) {
    if (key.startsWith('DTSTART')) {
        event.start = parseICalDate(value);
        event.isAllDay = !key.includes('TZID') && value.length === 8;
    } else if (key.startsWith('DTEND')) {
        event.end = parseICalDate(value);
    } else if (key === 'SUMMARY') {
        event.summary = decodeICalText(value);
    } else if (key === 'DESCRIPTION') {
        event.description = decodeICalText(value);
    } else if (key === 'LOCATION') {
        event.location = decodeICalText(value);
    }
}

// Function to parse iCal date format
function parseICalDate(dateString) {
    // Normalize and handle multiple formats:
    // - YYYYMMDD (all-day)
    // - YYYYMMDDTHHMMSSZ
    // - YYYYMMDDTHHMMSS (no Z)
    // - YYYYMMDDTHHMM (no seconds)
    let s = (dateString || '').trim();
    if (!s) return null;

    // All-day date
    if (/^\d{8}$/.test(s)) {
        const year = parseInt(s.substring(0, 4), 10);
        const month = parseInt(s.substring(4, 6), 10);
        const day = parseInt(s.substring(6, 8), 10);
        return new Date(year, month - 1, day);
    }

    // Remove trailing Z if present (indicates UTC)
    const isUTC = s.endsWith('Z');
    if (isUTC) s = s.slice(0, -1);

    // Expect a T separator for date/time
    const parts = s.split('T');
    const datePart = parts[0];
    const timePart = parts[1] || '';

    const year = parseInt(datePart.substring(0, 4), 10);
    const month = parseInt(datePart.substring(4, 6), 10);
    const day = parseInt(datePart.substring(6, 8), 10);

    // parse hours/minutes/seconds from timePart (pad if needed)
    let hh = 0, mm = 0, ss = 0;
    if (timePart.length >= 2) hh = parseInt(timePart.substring(0, 2), 10) || 0;
    if (timePart.length >= 4) mm = parseInt(timePart.substring(2, 4), 10) || 0;
    if (timePart.length >= 6) ss = parseInt(timePart.substring(4, 6), 10) || 0;

    if (isUTC) {
        return new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
    }

    // No timezone info — treat as local time
    return new Date(year, month - 1, day, hh, mm, ss);
}

// Function to decode iCal text (handle escaped characters)
function decodeICalText(text) {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

// Function to fetch iCal data using a CORS proxy
async function fetchICalData() {
    try {
        console.log('Fetching iCal data...');
        
        // Using a CORS proxy to fetch the iCal data
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(ICAL_URL)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw iCal data (proxy):', data.contents.slice(0, 120));

        // Some proxies (like AllOrigins) return a data URI with base64 content.
        let icalText = data.contents;
        if (typeof icalText === 'string' && icalText.startsWith('data:')) {
            const comma = icalText.indexOf(',');
            const b64 = icalText.substring(comma + 1);
            try {
                // atob decodes base64 to binary string; convert to UTF-8 using TextDecoder
                const binary = atob(b64);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                icalText = new TextDecoder('utf-8').decode(bytes);
            } catch (decodeErr) {
                console.warn('Failed to decode base64 data URI, falling back to raw contents', decodeErr);
            }
        }

        const events = parseICalData(icalText);
        console.log('Parsed events:', events);
        
        return events;
    } catch (error) {
        console.error('Error fetching iCal data:', error);
        
        // Try alternative CORS proxy
        try {
            console.log('Trying alternative CORS proxy...');
            const altProxyUrl = `https://cors-anywhere.herokuapp.com/${ICAL_URL}`;
            const altResponse = await fetch(altProxyUrl);
            
            if (altResponse.ok) {
                const altData = await altResponse.text();
                console.log('Alternative proxy data:', altData);
                return parseICalData(altData);
            }
        } catch (altError) {
            console.error('Alternative proxy also failed:', altError);
        }
        
        return [];
    }
}

// Function to format date and time
function formatDateTime(date, isAllDay = false) {
    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    if (!isAllDay) {
        options.hour = 'numeric';
        options.minute = '2-digit';
        options.hour12 = true;
    }
    
    return date.toLocaleDateString('en-IN', options);
}

// Function to render events
function renderEvents(events) {
    console.log('Rendering events:', events);
    const eventsContainer = document.getElementById('events-list');
    const loadingContainer = document.getElementById('loading');
    const noEventsContainer = document.getElementById('no-events');
    
    loadingContainer.classList.add('hidden');
    
    if (events.length === 0) {
        console.log('No events to display');
        noEventsContainer.classList.remove('hidden');
        return;
    }
    
    console.log(`Displaying ${events.length} events`);
    eventsContainer.innerHTML = '';
    
    events.forEach((event, index) => {
        const eventElement = document.createElement('div');
    eventElement.className = 'bg-white rounded-lg p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 flex items-center';

        // Extract day and month for left column
        const dateObj = new Date(event.start);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleString('en-US', { month: 'short' });

        // Date/time display for right column
        const dateStr = formatDateTime(event.start, event.isAllDay);
    // ...removed redundant timeDisplay declaration...
        eventElement.innerHTML = `
            <div class="flex-shrink-0 flex flex-col items-center justify-center mr-10">
                <div class="text-4xl font-extrabold text-royal-blue leading-none">${day}</div>
                <div class="text-lg font-semibold text-royal-blue uppercase tracking-wide">${month}</div>
            </div>
            <div class="flex-grow">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">${event.summary || 'Untitled Event'}</h3>
                ${event.location ? `<div class="text-gray-600 mb-4"><i class="fa-solid fa-location-dot text-gold mr-2"></i>${event.location}</div>` : ''}
                ${event.description ? `<div class="text-gray-700 mt-6 prose prose-sm">${event.description.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        `;
        eventsContainer.appendChild(eventElement);
    });
    
    eventsContainer.classList.remove('hidden');
}

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', async function() {
    const events = await fetchICalData();
    renderEvents(events);
});
