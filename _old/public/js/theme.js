/**
 * Theme Switcher Functionality
 * Handles theme selection and persistence using localStorage
 * Supports real-time theme synchronization between host and viewers
 */

document.addEventListener('DOMContentLoaded', () => {
    const globalThemeSelector = document.getElementById('globalThemeSelector');
    const localThemeSelector = document.getElementById('localThemeSelector');
    const viewerThemeSelector = document.getElementById('themeSelector');
    
    // Load saved theme from localStorage or use default
    const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
    
    // Set the initial theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Set the dropdowns to match the current theme
    if (globalThemeSelector) globalThemeSelector.value = savedTheme;
    if (localThemeSelector) localThemeSelector.value = savedTheme;
    if (viewerThemeSelector) viewerThemeSelector.value = savedTheme;
    
    // Check if Socket.IO is available
    const isSocketAvailable = typeof io !== 'undefined';
    let socket;
    
    if (isSocketAvailable) {
        socket = io();
        
        // Listen for theme updates from the server
        socket.on('themeUpdate', (theme) => {
            console.log('Received theme update:', theme);
            
            // Update the theme
            document.documentElement.setAttribute('data-theme', theme);
            
            // Update the dropdowns
            if (globalThemeSelector) globalThemeSelector.value = theme;
            if (localThemeSelector) localThemeSelector.value = theme;
            if (viewerThemeSelector) viewerThemeSelector.value = theme;
            
            // Save to localStorage
            localStorage.setItem('selectedTheme', theme);
        });
    }
    
    // Determine if this is the host page
    const isHostPage = window.location.pathname.includes('host.html');
    
    // Add event listeners for theme changes
    if (globalThemeSelector) {
        globalThemeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            
            // Update the data-theme attribute
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Update local selector if it exists
            if (localThemeSelector) localThemeSelector.value = newTheme;
            
            // Save to localStorage for persistence
            localStorage.setItem('selectedTheme', newTheme);
            
            // If Socket.IO is available, broadcast the theme change
            if (isSocketAvailable) {
                console.log('Broadcasting global theme change:', newTheme);
                socket.emit('themeChange', newTheme);
            }
        });
    }

    if (localThemeSelector) {
        localThemeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            
            // Update the data-theme attribute only locally
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Save to localStorage for persistence
            localStorage.setItem('selectedTheme', newTheme);
        });
    }

    if (viewerThemeSelector) {
        viewerThemeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            
            // Update the data-theme attribute only locally
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Save to localStorage for persistence
            localStorage.setItem('selectedTheme', newTheme);
        });
    }
});