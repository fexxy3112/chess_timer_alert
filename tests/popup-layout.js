(async function () {
    const view = new URLSearchParams(location.search).get('layout');
    let result = 'PASS Quiet Mint layout';
    try {
        if (view === 'settings') document.getElementById('openSettings').click();
        for (let i = 0; i < 12; i++) await Promise.resolve();
        await document.fonts.ready;
        if (view === 'preset') document.getElementById('editPreset').click();
        if (document.documentElement.scrollWidth > 390) throw new Error('Horizontal overflow');
        if (document.body.scrollHeight !== 600 || document.documentElement.getBoundingClientRect().height !== 600)
            throw new Error(`Popup height ${document.body.scrollHeight} is not fixed at 600 px`);
        const shell = document.querySelector('.app-shell').getBoundingClientRect();
        const body = document.body.getBoundingClientRect();
        const root = document.documentElement.getBoundingClientRect();
        if (shell.width !== 390) throw new Error(`Popup width ${shell.width} is not fixed at 390 px`);
        if (Math.abs(body.width - root.width) > 1 || shell.width > body.width)
            throw new Error(`Popup body width ${body.width} does not fit root width ${root.width}`);
        const icon = document.querySelector('.brand-mark .symbol');
        if (!Array.from(document.fonts).some(font => font.family.includes('Material Symbols Outlined') && font.status === 'loaded') ||
            !getComputedStyle(icon).fontFamily.includes('Material Symbols Outlined'))
            throw new Error('Google icon font unavailable');
        const footer = document.querySelector('.app-footer').getBoundingClientRect();
        if (footer.bottom > 600 || footer.right > 390) throw new Error('Footer clipped');
        if (view === 'alerts') {
            const assertAligned = () => {
                const card = document.getElementById('connection').getBoundingClientRect();
                const settings = document.getElementById('openSettings').getBoundingClientRect();
                if (Math.abs(card.right - footer.right) > 1 || Math.abs(settings.right - footer.right) > 1)
                    throw new Error('Main content has an extra right margin');
            };
            await new Promise(resolve => requestAnimationFrame(resolve));
            assertAligned();
            feedback('Preset saved. Choose Save changes to apply these alerts.');
            await new Promise(resolve => requestAnimationFrame(resolve));
            assertAligned();
            if (document.body.scrollHeight !== 600) throw new Error('Feedback resized the popup');
            feedback('');
        }
        if (view === 'settings') {
            const main = document.querySelector('main').getBoundingClientRect();
            const settings = document.getElementById('playerView').getBoundingClientRect();
            const username = document.getElementById('username');
            const selectWrap = document.querySelector('#playerView .select-wrap').getBoundingClientRect();
            const clockColor = document.getElementById('clockColor').getBoundingClientRect();
            const focusRule = Array.from(document.styleSheets)
                .flatMap(sheet => Array.from(sheet.cssRules))
                .find(rule => rule.selectorText === '.username-input:focus');
            username.focus();
            if (Math.abs(settings.left - main.left) > 1 || Math.abs(settings.right - main.right) > 1)
                throw new Error('Settings view width does not match the main content area');
            if (selectWrap.left < main.left - 1 || selectWrap.right > main.right + 1 ||
                clockColor.left < main.left - 1 || clockColor.right > main.right + 1)
                throw new Error('Clock select exceeds the main content area');
            if (!focusRule || focusRule.style.outlineOffset !== '-2px')
                throw new Error('Username focus outline is not inset within the field');
            username.style.outline = `2px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent')}`;
            username.style.outlineOffset = focusRule.style.outlineOffset;
        }
    } catch (error) { result = `FAIL ${error.message}`; }
    void fetch('/__result', { method: 'POST', body: result });
})();
