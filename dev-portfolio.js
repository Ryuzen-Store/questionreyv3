/** Developer portfolio page for QuestionRy. */

export function renderDevPortfolio(view) {
  const container = document.createElement('div');
  container.className = 'page container dev-portfolio';

  container.innerHTML = `
    <section class="dev-card">
      <p class="dev-kicker">DEVELOPER PORTFOLIO</p>
      <h1 class="dev-title">Ry Dev</h1>
      <div class="dev-info">
        <div><span>Bahasa Pemrograman</span><strong>Python, JS, Java</strong></div>
        <div><span>Bidang</span><strong>UI, Frontend, Backend, DevOps <em>(skill issue biasanya)</em></strong></div>
        <div><span>Lokasi</span><strong>Bogor, Jawa Barat, Indonesia</strong></div>
      </div>
    </section>
  `;

  view.appendChild(container);
  return { cleanup: () => {} };
}
