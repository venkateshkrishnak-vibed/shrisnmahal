// Video carousel logic for 'Experience our venue' section
document.addEventListener('DOMContentLoaded', function() {
    const videoSources = [
        'https://www.youtube.com/embed/EZewGOc-fho?rel=0&modestbranding=1',
        'https://www.youtube.com/embed/yIP3Wz1JgRo?rel=0&modestbranding=1',
        'https://www.youtube.com/embed/cx2OITPwfXQ?rel=0&modestbranding=1',
        'https://www.youtube.com/embed/xwp81L5kXys?rel=0&modestbranding=1'
    ];
    
    let currentVideo = 0;
    const videoElement = document.getElementById('venue-video');
    const leftBtn = document.getElementById('video-left');
    const rightBtn = document.getElementById('video-right');
    
    function showVideo(idx) {
        if (videoElement) {
            videoElement.src = videoSources[idx];
        }
    }
    
    if (leftBtn && rightBtn && videoElement) {
        leftBtn.addEventListener('click', function() {
            currentVideo = (currentVideo - 1 + videoSources.length) % videoSources.length;
            showVideo(currentVideo);
        });
        rightBtn.addEventListener('click', function() {
            currentVideo = (currentVideo + 1) % videoSources.length;
            showVideo(currentVideo);
        });
        showVideo(currentVideo);
    }
});
function toggleFAQ(faqId) {
    const content = document.getElementById(faqId + '-content');
    const icon = document.getElementById(faqId + '-icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        content.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}
