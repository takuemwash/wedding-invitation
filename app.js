/**
 * TAKUDZWA MWASHITA & HULDER JONGWE - RSVP WEDDING PORTAL
 * Date: 6 January 2027 (10:00 AM – 5:00 PM)
 * RSVP Deadline: 20 December 2026
 * Contacts: Rufaro Govere (+263773571221) & Hulder Jongwe (+263787896967)
 * Strictly by invitation only & Strictly No Children
 */

// Public submission endpoint; the private tracker is never exposed.
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbySW-qQZQsF6uH6kxPLhSb7GpwY7287PsuTTht1FCLO4iiCfZDei7cCJbshl4O9UNDUEQ/exec';
// Private mode and some in-app browsers deny persistent storage.
const memoryStorage = {};
const safeStorage = {
    getItem(key) {
        try { return localStorage.getItem(key) || memoryStorage[key] || null; }
        catch (_) { return memoryStorage[key] || null; }
    },
    setItem(key, value) {
        memoryStorage[key] = String(value);
        try { localStorage.setItem(key, value); } catch (_) {}
    }
};
function rsvpIdentity(key) {
    let value = safeStorage.getItem(key);
    if (!value) {
        value = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : 'TH-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        safeStorage.setItem(key, value);
    }
    return value;
}

// Initial Default State
const defaultWeddingState = {
    groom: 'Takudzwa Mwashita',
    bride: 'Hulder Jongwe',
    date: '2027-01-06T10:00:00',
    timeText: '10:00 AM – 5:00 PM',
    rsvpDeadline: '2026-12-20',
    venue: 'To be announced / Private Venue',
    location: 'Harare, Zimbabwe',
    dressCode: 'Brown Shades & Formal Elegance',
    dressDesc: 'Beige, Sand, Cocoa, Chocolate, Espresso, Ivory & Sugar.',
    songUrl: 'https://youtu.be/JiZ9TJPTHaM?list=RDJiZ9TJPTHaM',
    note: 'Strictly by invitation only & Strictly No Children'
};

// Global YouTube Player variables
let ytPlayer = null;
let isYtReady = false;

// Every newly opened invitation starts on the card, including shared section links.
window.addEventListener('pageshow', () => {
    history.scrollRestoration = 'manual';
    history.replaceState(null, '', location.pathname + location.search + '#hero');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
});

document.addEventListener('DOMContentLoaded', () => {
    initInvitationGate();
    try { setupMusicSource(defaultWeddingState.songUrl); } catch (_) {}
    // Retry sound on the first gesture if the browser blocks autoplay on arrival.
    const retryMusic = (event) => {
        if (event.target.closest && event.target.closest('#musicToggleBtn')) return;
        if (!isAudioPlaying) playMusic();
        if (isAudioPlaying) {
            document.removeEventListener('pointerdown', retryMusic);
            document.removeEventListener('keydown', retryMusic);
        }
    };
    document.addEventListener('pointerdown', retryMusic);
    document.addEventListener('keydown', retryMusic);
});

function openInvitation() {
    document.getElementById('invitationGate').hidden = true;
    document.getElementById('invitationContent').hidden = false;
    history.replaceState(null, '', location.pathname + location.search + '#hero');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.getElementById('invitationContent').dataset.initialized) {
        updateRsvpAvailability();
        window.dispatchEvent(new Event('hashchange'));
        return;
    }
    document.getElementById('invitationContent').dataset.initialized = 'true';
    initWeddingState();
    initCountdown();
    initSwatchesInteractive();
    initImageZoom();
    if (!document.getElementById('weddingRsvpForm').dataset.initialized) {
        initRsvpForm();
        document.getElementById('weddingRsvpForm').dataset.initialized = 'true';
    }
    updateRsvpAvailability();

    initCalendarLinks();
    initAudioPlayer();
    initInvitationPages();
    initCardFraming();
}

function initInvitationPages() {
    const pageIds = ['hero', 'palette', 'details', 'contacts', 'rsvp'];
    const showPage = () => {
        const requested = location.hash.slice(1);
        const active = pageIds.includes(requested) ? requested : 'hero';
        document.querySelectorAll('#invitationContent main > section').forEach(section => {
            section.hidden = section.id !== active;
            if (!section.hidden) section.scrollTop = 0;
        });
        document.querySelectorAll('.nav-links a').forEach(link => {
            if (link.hash === '#' + active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        const navHeight = document.querySelector('.top-nav').getBoundingClientRect().height;
        document.documentElement.style.setProperty('--nav-height', navHeight + 'px');
        window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', showPage);
    window.addEventListener('resize', showPage);
    showPage();
}

function initInvitationGate() {
    const form = document.getElementById('invitationPasswordForm');
    const input = document.getElementById('invitationPassword');
    const error = document.getElementById('gateError');
    const button = document.getElementById('unlockInvitationBtn');
    const showButton = document.getElementById('showInvitationPassword');
    showButton.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        showButton.textContent = show ? 'Hide' : 'Show';
        showButton.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        showButton.setAttribute('aria-pressed', String(show));
    });
    input.addEventListener('input', () => {
        error.textContent = '';
        input.removeAttribute('aria-invalid');
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (button.disabled) return;
        button.disabled = true;
        error.textContent = '';
        try {
            // This is a browser-level invitation gate, not server-side authorization.
            // This existing client-side gate does not require Web Crypto support.
            if (input.value !== 'takuhulder') {
                error.textContent = 'That password does not match. Please check your invitation and try again.';
                input.setAttribute('aria-invalid', 'true');
                input.focus();
                return;
            }
            input.value = '';
            openInvitation();
        } catch (err) {
            error.textContent = 'The invitation could not open. Please refresh and try again.';
        } finally {
            button.disabled = false;
        }
    });
}

/* ==========================================
   1. STATE MANAGEMENT & UI UPDATE
   ========================================== */
function getWeddingState() {
    const saved = safeStorage.getItem('takudzwa_hulder_wedding_state_v3');
    try { return saved ? Object.assign({}, defaultWeddingState, JSON.parse(saved)) : defaultWeddingState; }
    catch (_) { return defaultWeddingState; }
}

function saveWeddingState(state) {
    safeStorage.setItem('takudzwa_hulder_wedding_state_v3', JSON.stringify(state));
    updateUIWithState(state);
    setupMusicSource(state.songUrl);
}

function initWeddingState() {
    const state = getWeddingState();
    updateUIWithState(state);

    if (document.getElementById('editDate')) document.getElementById('editDate').value = state.date.split('T')[0];
    if (document.getElementById('editTime')) document.getElementById('editTime').value = state.timeText;
    if (document.getElementById('editGroom')) document.getElementById('editGroom').value = state.groom;
    if (document.getElementById('editBride')) document.getElementById('editBride').value = state.bride;
    if (document.getElementById('editRsvpDeadline')) document.getElementById('editRsvpDeadline').value = state.rsvpDeadline;
    if (document.getElementById('editSongUrl')) document.getElementById('editSongUrl').value = state.songUrl || defaultWeddingState.songUrl;
}

function updateUIWithState(state) {
    const eventDate = new Date(state.date);
    const dateFormatted = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const deadlineDate = new Date(state.rsvpDeadline);
    const deadlineFormatted = deadlineDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    if (document.getElementById('displayFullDate')) document.getElementById('displayFullDate').textContent = dateFormatted;
    if (document.getElementById('displayTime')) document.getElementById('displayTime').textContent = state.timeText;
    if (document.getElementById('displayDeadlineText')) document.getElementById('displayDeadlineText').textContent = deadlineFormatted;
}

/* ==========================================
   2. COUNTDOWN TIMER
   ========================================== */
let countdownInterval;

function initCountdown() {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const state = getWeddingState();
    const targetTime = new Date(state.date).getTime();
    const currentTime = new Date().getTime();
    const difference = targetTime - currentTime;

    if (difference <= 0) {
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        return;
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

/* ==========================================
   3. INTERACTIVE BROWN SHADES PALETTE
   ========================================== */
function initSwatchesInteractive() {
    const swatchItems = document.querySelectorAll('.swatch-item');
    const previewCircle = document.getElementById('previewShadeCircle');
    const previewName = document.getElementById('previewShadeName');
    const previewSub = document.getElementById('previewShadeSub');
    const previewHex = document.getElementById('previewHex');
    const previewDesc = document.getElementById('previewShadeDesc');
    const copyBtn = document.getElementById('copyHexBtn');

    swatchItems.forEach(item => {
        item.addEventListener('click', () => {
            swatchItems.forEach(s => s.classList.remove('active'));
            item.classList.add('active');

            const name = item.getAttribute('data-name');
            const sub = item.getAttribute('data-sub');
            const hex = item.getAttribute('data-hex');
            const desc = item.getAttribute('data-desc');

            if (previewCircle) previewCircle.style.backgroundColor = hex;
            if (previewName) previewName.textContent = name;
            if (previewSub) previewSub.textContent = sub;
            if (previewHex) previewHex.textContent = hex;
            if (previewDesc) previewDesc.textContent = desc;
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const hexText = previewHex.textContent;
            navigator.clipboard.writeText(hexText).then(() => {
                const orig = copyBtn.innerHTML;
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
                setTimeout(() => {
                    copyBtn.innerHTML = orig;
                }, 2000);
            });
        });
    }
}

/* ==========================================
   4. IMAGE ZOOM MODALS
   ========================================== */
function initImageZoom() {
    const zoomModal = document.getElementById('imageZoomModal');
    const zoomedImg = document.getElementById('zoomedImgSrc');
    const closeZoomBtn = document.getElementById('closeZoomBtn');
    
    const cardTrigger = document.getElementById('openCardZoomBtn');
    const swatchTrigger = document.getElementById('openSwatchZoomBtn');

    if (cardTrigger) {
        cardTrigger.addEventListener('click', () => {
            zoomedImg.src = 'assets/wedding_card_hulder.png';
            zoomedImg.alt = 'Takudzwa & Hulder Wedding Invitation Card';
            zoomModal.style.display = 'flex';
        });
    }

    if (swatchTrigger) {
        swatchTrigger.addEventListener('click', () => {
            zoomedImg.src = 'assets/brown_shades_swatches.jpg';
            zoomedImg.alt = 'Brown Shades Wedding Fabric Swatches';
            zoomModal.style.display = 'flex';
        });
    }

    if (closeZoomBtn) {
        closeZoomBtn.addEventListener('click', () => {
            zoomModal.style.display = 'none';
        });
    }

    if (zoomModal) {
        zoomModal.addEventListener('click', (e) => {
            if (e.target === zoomModal) {
                zoomModal.style.display = 'none';
            }
        });
    }
}

/* ==========================================
   5. RSVP FORM & GUEST MANAGEMENT
   ========================================== */
function getGuestList() {
    const stored = safeStorage.getItem('takudzwa_hulder_wedding_guests_v3');
    return stored ? JSON.parse(stored) : [];
}

function saveGuestList(list) {
    safeStorage.setItem('takudzwa_hulder_wedding_guests_v3', JSON.stringify(list));
}

function initRsvpForm() {
    const form = document.getElementById('weddingRsvpForm');
    const optAttending = document.getElementById('optAttending');
    const optDeclining = document.getElementById('optDeclining');
    const guestCountGroup = document.getElementById('guestCountGroup');
    const guestCountSelect = document.getElementById('guestCount');
    const plusOneGroup = document.getElementById('plusOneGroup');

    if (optAttending && optDeclining) {
        optAttending.addEventListener('click', () => {
            optAttending.classList.add('selected');
            optDeclining.classList.remove('selected');
            guestCountGroup.style.display = 'flex';
        });

        optDeclining.addEventListener('click', () => {
            optDeclining.classList.add('selected');
            optAttending.classList.remove('selected');
            guestCountGroup.style.display = 'none';
            plusOneGroup.style.display = 'none';
        });
    }

    if (guestCountSelect) {
        guestCountSelect.addEventListener('change', (e) => {
            if (e.target.value === '2') {
                plusOneGroup.style.display = 'flex';
            } else {
                plusOneGroup.style.display = 'none';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (hasSubmittedRsvp()) { updateRsvpAvailability(); return; }

            const isAttending = document.querySelector('input[name="attendance"]:checked').value === 'attending';
            const name = document.getElementById('guestName').value.trim();
            const guestsCount = isAttending ? parseInt(guestCountSelect.value, 10) : 0;
            const plusOneNames = isAttending && guestsCount > 1 ? document.getElementById('plusOneNames').value.trim() : '';
            const message = document.getElementById('guestMessage').value.trim();
            const acknowledged = document.getElementById('policyAcknowledge').checked;

            if (!name) {
                alert('Please provide your Full Name.');
                return;
            }

            if (!acknowledged) {
                alert('Please acknowledge the event policy: Strictly by invitation only & Strictly No Children.');
                return;
            }

            const guestEntry = {
                id: rsvpIdentity('takudzwa_hulder_rsvp_request'),
                name,
                attendance: isAttending ? 'Attending' : 'Declined',
                guestsCount,
                plusOneNames,
                message,
                submittedAt: new Date().toLocaleString()
            };

            const submitButton = document.getElementById('submitRsvpBtn');
            if (submitButton.disabled) return;
            const originalButton = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.textContent = 'Sending RSVP…';
            try {
                const response = await fetch(RSVP_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8'
                    },
                    body: JSON.stringify({
                        ...guestEntry,
                        browserId: rsvpIdentity('takudzwa_hulder_browser_id'),
                        acknowledged: true
                    })
                });
                const result = await response.json();
                if (!response.ok || result.success !== true) {
                    throw new Error('Your RSVP could not be sent. Please try again or contact an RSVP coordinator using the WhatsApp links above.');
                }
                // Keep a browser-local copy only after the shared tracker confirms the RSVP.
                try {
                    const guests = getGuestList();
                    guests.unshift(guestEntry);
                    saveGuestList(guests);
                } catch (storageError) {
                    console.warn('RSVP sent, but a local copy could not be saved.');
                }
                markRsvpSubmitted();
                updateRsvpAvailability();
                returnToPasswordScreen();
                form.reset();
                optAttending.click();
                plusOneGroup.style.display = 'none';
            } catch (err) {
                alert(err.message || 'Your RSVP could not be sent. Please try again or contact an RSVP coordinator.');
            } finally {
                submitButton.disabled = hasSubmittedRsvp();
                if (hasSubmittedRsvp()) submitButton.textContent = 'You have already RSVP’d';
                else submitButton.innerHTML = originalButton;
            }
        });
    }

    const confModal = document.getElementById('confirmationModal');
    const closeConfBtn = document.getElementById('closeConfModalBtn');
    const printBtn = document.getElementById('printTicketBtn');

    if (closeConfBtn) {
        closeConfBtn.addEventListener('click', () => {
            confModal.style.display = 'none';
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

function showConfirmationModal(guest) {
    const confModal = document.getElementById('confirmationModal');
    const confTitle = document.getElementById('confModalTitle');
    const confMsg = document.getElementById('confModalMsg');
    const confGuestName = document.getElementById('confGuestName');
    const ticketCode = document.getElementById('ticketCode');
    const ticketStatus = document.getElementById('ticketStatus');
    const ticketDetails = document.getElementById('ticketDetails');

    confGuestName.textContent = guest.name;
    ticketCode.textContent = guest.id;

    if (guest.attendance === 'Attending') {
        confTitle.textContent = 'RSVP Confirmed with Joy!';
        confMsg.innerHTML = `We are delighted to celebrate with you, <strong>${guest.name}</strong>!`;
        ticketStatus.textContent = 'Status: Confirmed Guest ✨';
        ticketDetails.textContent = `Seats: ${guest.guestsCount} | 6 Jan 2027 (10:00 AM – 5:00 PM)`;
        
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#C59B27', '#6E473B', '#FAF6F0', '#C8B195']
            });
        }
    } else {
        confTitle.textContent = 'Response Recorded';
        confMsg.innerHTML = `Thank you for letting us know, <strong>${guest.name}</strong>. You will be dearly missed!`;
        ticketStatus.textContent = 'Status: Regretfully Declined';
        ticketDetails.textContent = `Sending Love to Takudzwa & Hulder`;
    }

    confModal.style.display = 'flex';
}

/* ==========================================
   6. ADMIN DASHBOARD & EDIT CONTROLS
   ========================================== */
function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/* ==========================================
   7. CALENDAR INTEGRATION
   ========================================== */
function initCalendarLinks() {
    const calendarBtn = document.getElementById('calendarBtn');
    const calendarDropdown = calendarBtn ? calendarBtn.parentElement : null;
    const googleCalLink = document.getElementById('addToGoogleCal');
    const iCalLink = document.getElementById('addToICal');

    if (calendarBtn) {
        calendarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarDropdown.classList.toggle('active');
        });

        document.addEventListener('click', () => {
            if (calendarDropdown) calendarDropdown.classList.remove('active');
        });
    }

    const title = encodeURIComponent('Wedding: Takudzwa Mwashita & Hulder Jongwe');
    const details = encodeURIComponent('Wedding Celebration for Takudzwa Mwashita and Hulder Jongwe.\nTime: 10:00 AM – 5:00 PM.\nStrictly by invitation only & Strictly No Children.\nDress Code: Brown Shades & Formal Elegance.');
    const location = encodeURIComponent('Harare, Zimbabwe');
    const dates = '20270106T080000Z/20270106T150000Z';

    if (googleCalLink) {
        googleCalLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
        googleCalLink.target = '_blank';
    }

    if (iCalLink) {
        iCalLink.addEventListener('click', (e) => {
            e.preventDefault();
            generateICSFile();
        });
    }
}

function generateICSFile() {
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Takudzwa and Hulder Wedding//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'SUMMARY:Wedding of Takudzwa Mwashita & Hulder Jongwe',
        'DESCRIPTION:Celebration of the Marriage of Takudzwa Mwashita and Hulder Jongwe. 10:00 AM - 5:00 PM. Strictly by invitation only & Strictly No Children.',
        'LOCATION:Harare, Zimbabwe',
        'DTSTART:20270106T080000Z',
        'DTEND:20270106T150000Z',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Takudzwa_Hulder_Wedding_2027.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ==========================================
   8. AUDIO & MUSIC PLAYER SUPPORT WITH AUTOPLAY
   ========================================== */
let isAudioPlaying = false;
let autoPlayAttempted = false;

function initAudioPlayer() {
    const musicBtn = document.getElementById('musicToggleBtn');
    const state = getWeddingState();
    if (!ytPlayer) setupMusicSource(state.songUrl);
    playMusic();

    if (musicBtn) {
        musicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isAudioPlaying) {
                pauseMusic();
            } else {
                setupMusicSource(state.songUrl);
                playMusic();
            }
        });
    }

}

function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function setupMusicSource(songUrl) {
    const audio = document.getElementById('weddingAudio');
    const ytId = extractYouTubeId(songUrl);

    if (ytId) {
        audio.pause();
        audio.src = '';
        if (!window.YT && !document.getElementById('youtubeApiScript')) {
            const script = document.createElement('script');
            script.id = 'youtubeApiScript';
            script.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(script);
        }
        initYouTubePlayer(ytId);
    } else if (songUrl && (songUrl.endsWith('.mp3') || songUrl.startsWith('http') || songUrl.startsWith('assets/'))) {
        audio.src = songUrl;
    }
}

function initYouTubePlayer(videoId) {
    if (window.YT && window.YT.Player) {
        if (ytPlayer) {
            ytPlayer.loadVideoById(videoId);
            ytPlayer.playVideo();
        } else {
            ytPlayer = new YT.Player('youtubePlayer', {
                height: '1',
                width: '1',
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    loop: 1,
                    playlist: videoId,
                    playsinline: 1,
                    enablejsapi: 1
                },
                events: {
                    onReady: (event) => {
                        event.target.setVolume(35);
                        isYtReady = true;
                        event.target.playVideo();
                    },
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            isAudioPlaying = true;
                            updateMusicButtonUI(true);
                        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                            isAudioPlaying = false;
                            updateMusicButtonUI(false);
                        }
                    },
                    onAutoplayBlocked: () => {
                        isAudioPlaying = false;
                        updateMusicButtonUI(false);
                    }
                }
            });
        }
    }
}

function onYouTubeIframeAPIReady() {
    const state = getWeddingState();
    const ytId = extractYouTubeId(state.songUrl);
    if (ytId) {
        initYouTubePlayer(ytId);
    }
}

function playMusic() {
    const audio = document.getElementById('weddingAudio');

    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
        try {
            ytPlayer.playVideo();
        } catch (e) {}
    } else if (audio && audio.src) {
        audio.play().then(() => {
            isAudioPlaying = true;
            updateMusicButtonUI(true);
        }).catch(() => {});
    }
}

function pauseMusic() {
    const audio = document.getElementById('weddingAudio');

    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        try {
            ytPlayer.pauseVideo();
        } catch (e) {}
    }
    if (audio) {
        audio.pause();
    }

    isAudioPlaying = false;
    updateMusicButtonUI(false);
}

function updateMusicButtonUI(isPlaying) {
    const musicBtn = document.getElementById('musicToggleBtn');
    if (!musicBtn) return;

    if (isPlaying) {
        musicBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Playing Music</span>`;
        musicBtn.style.borderColor = '#E5C568';
        musicBtn.style.boxShadow = '0 0 16px rgba(229, 197, 104, 0.4)';
    } else {
        musicBtn.innerHTML = `<i class="fa-solid fa-music"></i> <span>Play Music</span>`;
        musicBtn.style.borderColor = 'var(--color-gold)';
        musicBtn.style.boxShadow = 'var(--shadow-deep)';
    }
}




// Fit the invitation paper, rather than the surrounding photograph, in every frame.
function initCardFraming() {
    const frame = document.querySelector('.hero-card-frame');
    const image = document.querySelector('.official-card-img');
    const fit = () => {
        if (!image.naturalWidth || !frame.clientWidth || !frame.clientHeight) return;
        const scale = Math.min(frame.clientWidth / (image.naturalWidth * .64), frame.clientHeight / (image.naturalHeight * .49));
        image.style.width = `${image.naturalWidth * scale}px`;
        image.style.height = `${image.naturalHeight * scale}px`;
    };
    image.addEventListener('load', fit);
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(frame);
    window.addEventListener('resize', fit);
    fit();
}
const RSVP_COMPLETED_KEY = 'takudzwa_hulder_rsvp_completed';
let rsvpCompletedInMemory = false;
function hasSubmittedRsvp() {
    if (rsvpCompletedInMemory) return true;
    try { return safeStorage.getItem(RSVP_COMPLETED_KEY) === 'true' || getGuestList().length > 0; }
    catch (_) { return false; }
}
function markRsvpSubmitted() {
    rsvpCompletedInMemory = true;
    try { safeStorage.setItem(RSVP_COMPLETED_KEY, 'true'); } catch (_) {}
}
function updateRsvpAvailability() {
    const done = hasSubmittedRsvp();
    const form = document.getElementById('weddingRsvpForm');
    form.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = done; });
    form.classList.toggle('rsvp-completed', done);
    if (done) document.getElementById('submitRsvpBtn').textContent = 'You have already RSVP’d';
    document.querySelectorAll('a[href="#rsvp"]').forEach(link => {
        if (done) {
            link.textContent = 'Already RSVP’d';
            link.setAttribute('aria-disabled', 'true');
            link.classList.add('rsvp-completed-link');
        }
    });
}
function returnToPasswordScreen() {
    document.getElementById('invitationContent').hidden = true;
    document.getElementById('invitationGate').hidden = false;
    document.getElementById('invitationPasswordForm').reset();
    document.getElementById('invitationPassword').type = 'password';
    document.getElementById('gateError').textContent = '';
    let notice = document.getElementById('rsvpGateNotice');
    if (!notice) {
        notice = document.createElement('p');
        notice.id = 'rsvpGateNotice';
        notice.setAttribute('role', 'status');
        document.getElementById('invitationPasswordForm').before(notice);
    }
    notice.textContent = 'Thank you! Your RSVP has been sent successfully. Enter the password to view the invitation again.';
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
}
