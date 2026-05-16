const SVG_NS = 'http://www.w3.org/2000/svg';

export const googleLogoSvg = (): SVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'google-icon');
  svg.setAttribute('aria-hidden', 'true');
  const paths: ReadonlyArray<{ fill: string; d: string }> = [
    {
      fill: '#FFC107',
      d: 'M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1L37.6 9.4C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.6-.4-3.5z',
    },
    {
      fill: '#FF3D00',
      d: 'M6.3 14.7L13 19.5c1.7-4.4 6-7.5 11-7.5 3.1 0 5.8 1.2 7.9 3.1L37.6 9.4C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z',
    },
    {
      fill: '#4CAF50',
      d: 'M24 44c5.2 0 9.9-2 13.4-5.2L31.2 33C29.2 34.6 26.7 36 24 36c-5.1 0-9.5-3.2-11.2-7.9L6.1 33.5C9.5 39.7 16.2 44 24 44z',
    },
    {
      fill: '#1976D2',
      d: 'M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2c-.4.4 6.7-4.9 6.7-14.9 0-1.3-.1-2.6-.4-3.5z',
    },
  ];
  for (const p of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', p.fill);
    path.setAttribute('d', p.d);
    svg.appendChild(path);
  }
  return svg;
};

export const setButtonGoogleLabel = (btn: HTMLButtonElement, label: string) => {
  btn.textContent = '';
  btn.appendChild(googleLogoSvg());
  btn.appendChild(document.createTextNode(label));
};
