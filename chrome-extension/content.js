if (window.location.href.includes('tennisrecruiting.net/player')) {

function extractPlayerData() {
    const data = {}

    // Name — white bold text in Verdana font
    const allDivs = document.querySelectorAll('div')
    for (const div of allDivs) {
      const style = div.getAttribute('style') || ''
      const text = div.innerText.trim()
      if (
        style.includes('#ffffff') &&
        style.includes('font-weight: bold') &&
        text.length > 3 &&
        text.length < 60 &&
        !text.match(/overview|tennis|recruit|ranking|record|information|profile/i) &&
        text.match(/^[A-Z]/)
      ) {
        data.name = text
        break
      }
    }

    // National ranking — inside a link that goes to /list.asp
    const rankLinks = document.querySelectorAll('a[href*="/list.asp"]')
    for (const link of rankLinks) {
      const text = link.innerText.trim()
      if (text.match(/^\d+$/)) {
        data.national_ranking = text
        break
      }
    }

    // Location — inside div with class "lrg"
    const locationEl = document.querySelector('div.lrg')
    if (locationEl) {
      data.location = locationEl.innerText.trim()
    }

    // Get all table cells for remaining fields
    const cells = Array.from(document.querySelectorAll('td'))
    const cellTexts = cells.map(c => c.innerText.trim())

    // Class year — inside div.med containing "Class of YYYY"
    const medDivs = document.querySelectorAll('div.med')
    for (const div of medDivs) {
      const text = div.innerText
      const match = text.match(/Class of (20[2-3]\d)/i)
      if (match) {
        data.class_year = match[1]
        break
      }
    }

    // Playing hand — find cell after "Plays" label
    const playsIdx = cellTexts.findIndex(t => t.match(/^Plays$|^Hand$/i))
    if (playsIdx !== -1 && cellTexts[playsIdx + 1]) {
      const hand = cellTexts[playsIdx + 1]
      data.plays = hand.match(/left/i) ? 'LHP' : 'RHP'
    } else {
      data.plays = 'RHP'
    }

    // Player ID from URL
    const urlMatch = window.location.href.match(/id=(\d+)/)
    if (urlMatch) data.tennisrecruiting_id = urlMatch[1]

    data.source_url = window.location.href

    return data
  }

  function createButton() {
    if (document.getElementById('courtiq-btn')) return

    const btn = document.createElement('div')
    btn.id = 'courtiq-btn'
    btn.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      ">
        <button id="courtiq-trigger" style="
          background: #2563eb;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(37,99,235,0.4);
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          ✦ Add to CourtIQ
        </button>
      </div>
    `
    document.body.appendChild(btn)

    document.getElementById('courtiq-trigger').addEventListener('click', () => {
      const data = extractPlayerData()
      showForm(data)
    })
  }

  function showForm(data) {
    const existing = document.getElementById('courtiq-form-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'courtiq-form-overlay'
    overlay.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      ">
        <div style="
          background: #0f2040;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          width: 440px;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
          <div style="
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div>
              <div style="font-size:16px;font-weight:600;">Add to CourtIQ</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Columbia Men's Tennis</div>
            </div>
            <button id="courtiq-close" style="
              background:none;border:none;color:#64748b;
              font-size:20px;cursor:pointer;padding:4px;
            ">×</button>
          </div>

          <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">

            <div>
              <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Full Name</label>
              <input id="cq-name" type="text" value="${data.name || ''}" style="
                width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;box-sizing:border-box;
              ">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Class Year</label>
                <input id="cq-class" type="text" value="${data.class_year || ''}" style="
                  width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;box-sizing:border-box;
                ">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Plays</label>
                <select id="cq-plays" style="
                  width:100%;background:#0f2040;border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;box-sizing:border-box;
                ">
                  <option value="RHP" ${data.plays === 'RHP' ? 'selected' : ''}>RHP</option>
                  <option value="LHP" ${data.plays === 'LHP' ? 'selected' : ''}>LHP</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">National Ranking</label>
                <input id="cq-ranking" type="number" value="${data.national_ranking || ''}" style="
                  width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;box-sizing:border-box;
                ">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Location</label>
                <input id="cq-location" type="text" value="${data.location || ''}" style="
                  width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                  border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;box-sizing:border-box;
                ">
              </div>
            </div>

            <div>
              <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Priority</label>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                ${['High', 'Medium', 'Watch'].map(p => `
                  <button class="cq-priority" data-priority="${p}" style="
                    padding:8px;border-radius:8px;font-size:12px;font-weight:600;
                    border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);
                    color:#94a3b8;cursor:pointer;
                  ">${p}</button>
                `).join('')}
              </div>
            </div>

            <div>
              <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;display:block;margin-bottom:6px;">Initial Notes</label>
              <textarea id="cq-notes" placeholder="First impressions, why you're interested..." style="
                width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;
                resize:none;height:80px;box-sizing:border-box;font-family:inherit;
              "></textarea>
            </div>

            <div id="cq-status" style="display:none;padding:10px 14px;border-radius:8px;font-size:13px;text-align:center;"></div>
          </div>

          <div style="
            padding:16px 24px;
            border-top:1px solid rgba(255,255,255,0.1);
            display:flex;justify-content:flex-end;gap:10px;
          ">
            <button id="courtiq-cancel" style="
              background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;padding:8px 16px;
            ">Cancel</button>
            <button id="courtiq-save" style="
              background:#2563eb;color:white;border:none;padding:8px 24px;
              border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
            ">Add to CourtIQ</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(overlay)

    let selectedPriority = 'Watch'
    const priorityBtns = overlay.querySelectorAll('.cq-priority')
    priorityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        priorityBtns.forEach(b => {
          b.style.background = 'rgba(255,255,255,0.05)'
          b.style.color = '#94a3b8'
          b.style.borderColor = 'rgba(255,255,255,0.1)'
        })
        btn.style.background = 'rgba(37,99,235,0.3)'
        btn.style.color = '#60a5fa'
        btn.style.borderColor = 'rgba(37,99,235,0.5)'
        selectedPriority = btn.dataset.priority
      })
    })

    overlay.querySelector('#courtiq-close').addEventListener('click', () => overlay.remove())
    overlay.querySelector('#courtiq-cancel').addEventListener('click', () => overlay.remove())

    overlay.querySelector('#courtiq-save').addEventListener('click', async () => {
      const saveBtn = overlay.querySelector('#courtiq-save')
      const status = overlay.querySelector('#cq-status')

      saveBtn.textContent = 'Saving...'
      saveBtn.style.opacity = '0.7'

      const payload = {
        name: overlay.querySelector('#cq-name').value,
        class_year: parseInt(overlay.querySelector('#cq-class').value) || null,
        plays: overlay.querySelector('#cq-plays').value,
        national_ranking: parseInt(overlay.querySelector('#cq-ranking').value) || null,
        location: overlay.querySelector('#cq-location').value,
        nationality: 'USA',
        priority: selectedPriority,
        notes: overlay.querySelector('#cq-notes').value,
        fit_score: 50,
        competing_schools: [],
        tennisrecruiting_id: data.tennisrecruiting_id || null,
      }

      try {
        const res = await fetch('https://courtiq-three.vercel.app/api/recruits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error('Failed')

        status.style.display = 'block'
        status.style.background = 'rgba(34,197,94,0.15)'
        status.style.border = '1px solid rgba(34,197,94,0.3)'
        status.style.color = '#4ade80'
        status.textContent = '✓ Added to CourtIQ successfully'
        saveBtn.style.display = 'none'

        setTimeout(() => overlay.remove(), 2000)
      } catch {
        status.style.display = 'block'
        status.style.background = 'rgba(239,68,68,0.15)'
        status.style.border = '1px solid rgba(239,68,68,0.3)'
        status.style.color = '#f87171'
        status.textContent = '✗ Failed to save. Check your connection.'
        saveBtn.textContent = 'Add to CourtIQ'
        saveBtn.style.opacity = '1'
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createButton)
  } else {
    createButton()
  }
}