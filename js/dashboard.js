import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast, closeModal } from './ui.js';
import { jobItem } from './jobs.js';

export async function loadUserDashboard() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  try {
    const { data: jobs } = await sb.from('jobs').select('*').eq('user_id', store.currentUser.id);
    
    if (jobs) {
      const active = jobs.filter(j => ['solicitado', 'aceptado', 'en_proceso'].includes(j.status));
      const done = jobs.filter(j => j.status === 'finalizado');
      
      const activeEl = document.getElementById('user-stat-active');
      const doneEl = document.getElementById('user-stat-done');
      
      if (activeEl) activeEl.textContent = active.length;
      if (doneEl) doneEl.textContent = done.length;
      
      const jobsEl = document.getElementById('user-jobs-list');
      if (jobsEl && active.length) {
        jobsEl.innerHTML = active.map(j => jobItem(j, 'user')).join('');
      }
    }
    
    loadFavorites();
    loadBudgets();
  } catch {}
}

export async function loadProDashboard() {
  if (!store.currentUser || !store.currentPro) return;
  
  const specialtyEl = document.getElementById('pro-dash-specialty');
  if (specialtyEl) {
    specialtyEl.textContent = store.currentPro.specialty || 'Tu especialidad';
  }
  
  const sb = getSupabase();
  try {
    const { data: jobs } = await sb.from('jobs').select('*').eq('professional_id', store.currentPro.id);
    
    if (jobs) {
      const newJ = jobs.filter(j => j.status === 'solicitado');
      const activeJ = jobs.filter(j => j.status === 'en_proceso');
      const doneJ = jobs.filter(j => j.status === 'finalizado');
      
      const newEl = document.getElementById('pro-stat-new');
      const activeEl = document.getElementById('pro-stat-active');
      const doneEl = document.getElementById('pro-stat-done');
      
      if (newEl) newEl.textContent = newJ.length;
      if (activeEl) activeEl.textContent = activeJ.length;
      if (doneEl) doneEl.textContent = doneJ.length;
      
      const newJobsEl = document.getElementById('pro-jobs-new');
      if (newJobsEl && newJ.length) {
        newJobsEl.innerHTML = newJ.map(j => jobItem(j, 'pro')).join('');
      }
    }
  } catch {}
  
  const featuredBtn = document.getElementById('btn-new-budget');
  if (featuredBtn) {
    featuredBtn.style.display = store.currentPro?.is_featured ? 'inline-flex' : 'none';
  }
  
  if (!store.currentPro?.is_featured) {
    const tab = document.getElementById('tab-pro-presupuestos');
    if (tab) {
      tab.innerHTML = `<div class="card" style="text-align:center;padding:40px;">
        <i class="fa fa-lock" style="font-size:2.5rem;color:var(--orange);margin-bottom:16px;display:block;"></i>
        <h3 style="font-size:1rem;margin-bottom:10px;">Función Destacados</h3>
        <p style="color:var(--gray);font-size:0.88rem;margin-bottom:20px;">Los presupuestos están disponibles para profesionales con Plan Destacado.</p>
        <button class="btn btn-orange" onclick="window.showSuscripcion()"><i class="fa fa-crown"></i>Activar Plan Destacado</button>
      </div>`;
    }
  }
}

export async function loadFavorites() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  try {
    const { data: favs } = await sb.from('favorites').select('*,professionals(*,users(full_name))').eq('user_id', store.currentUser.id);
    
    const favsEl = document.getElementById('user-favs-grid');
    const favsStatEl = document.getElementById('user-stat-favs');
    
    if (favsStatEl) favsStatEl.textContent = favs?.length || 0;
    
    if (favsEl && favs?.length) {
      const { proCard } = await import('./professionals.js');
      favsEl.innerHTML = favs.map(f => proCard(f.professionals)).join('');
    }
  } catch {}
}

export async function loadBudgets() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  try {
    const { data: budgets } = await sb.from('budgets').select('*').eq('user_id', store.currentUser.id);
    
    const budgetsEl = document.getElementById('user-budgets-list');
    const budgetsStatEl = document.getElementById('user-stat-budgets');
    
    if (budgetsStatEl) budgetsStatEl.textContent = budgets?.length || 0;
    
    if (budgetsEl && budgets?.length) {
      budgetsEl.innerHTML = budgets.map(b => `
        <div class="job-item">
          <div class="job-icon" style="background:rgba(6,182,212,0.1);color:var(--accent);"><i class="fa fa-file-invoice"></i></div>
          <div class="job-info">
            <div class="job-title">${b.description || 'Presupuesto'}</div>
            <div class="job-meta">$${b.price || 0} · ${b.client_name || ''}</div>
          </div>
        </div>
      `).join('');
    }
  } catch {}
}

export async function saveAvailability() {
  if (!store.currentPro) return;
  
  const sb = getSupabase();
  const dias = Array.from(document.querySelectorAll('#dias-laborales input:checked')).map(c => c.value);
  const desde = document.getElementById('hora-desde')?.value;
  const hasta = document.getElementById('hora-hasta')?.value;
  const urgencias = document.getElementById('urgencias')?.checked;
  
  const { error } = await sb.from('professionals').update({
    availability: { dias, desde, hasta, urgencias }
  }).eq('id', store.currentPro.id);
  
  if (error) {
    showToast('Error al guardar', 'error');
  } else {
    showToast('Disponibilidad actualizada', 'success');
  }
}

export async function saveProfile() {
  if (!store.currentUser) return;
  
  const sb = getSupabase();
  const name = document.getElementById('edit-name')?.value.trim();
  const phone = document.getElementById('edit-phone')?.value.trim();
  const city = document.getElementById('edit-city')?.value.trim();
  
  const { error } = await sb.from('profiles').update({
    full_name: name,
    phone,
    city
  }).eq('id', store.currentUser.id);
  
  if (error) {
    showToast('Error al guardar', 'error');
  } else {
    showToast('Perfil actualizado', 'success');
  }
}

export async function saveProProfile() {
  if (!store.currentUser || !store.currentPro) return;
  
  const sb = getSupabase();
  const name = document.getElementById('pro-edit-name')?.value;
  const specialty = document.getElementById('pro-edit-specialty')?.value;
  const desc = document.getElementById('pro-edit-desc')?.value;
  const city = document.getElementById('pro-edit-city')?.value;
  const province = document.getElementById('pro-edit-province')?.value;
  const zones = document.getElementById('pro-edit-zones')?.value.split(',').map(z => z.trim()).filter(Boolean);
  const whatsapp = document.getElementById('pro-edit-whatsapp')?.value;
  
  const { error } = await sb.from('professionals').update({
    specialty,
    description: desc,
    city,
    province,
    zones,
    whatsapp
  }).eq('id', store.currentPro.id);
  
  await sb.from('profiles').update({ full_name: name }).eq('id', store.currentUser.id);
  
  if (error) {
    showToast('Error al guardar', 'error');
  } else {
    showToast('Perfil profesional actualizado', 'success');
  }
}

export async function saveBudget() {
  if (!store.currentUser || !store.currentPro) return;
  
  const sb = getSupabase();
  const client = document.getElementById('budget-client')?.value.trim();
  const desc = document.getElementById('budget-desc')?.value.trim();
  const price = document.getElementById('budget-price')?.value;
  const date = document.getElementById('budget-date')?.value;
  
  if (!client || !desc || !price) {
    showToast('Completá todos los campos', 'error');
    return;
  }
  
  const { error } = await sb.from('budgets').insert({
    professional_id: store.currentPro.id,
    client_name: client,
    description: desc,
    price,
    date,
    created_at: new Date().toISOString()
  });
  
  closeModal('modal-new-budget');
  
  if (error) {
    showToast('Error al guardar presupuesto', 'error');
  } else {
    showToast('Presupuesto guardado', 'success');
  }
}

export function generateBudgetPDF() {
  const client = document.getElementById('budget-client')?.value;
  const desc = document.getElementById('budget-desc')?.value;
  const price = document.getElementById('budget-price')?.value;
  const date = document.getElementById('budget-date')?.value;
  const proName = store.currentUser?.user_metadata?.full_name || 'Profesional';
  
  const html = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;padding:40px;color:#333;}h1{color:#4f46e5;}table{width:100%;border-collapse:collapse;margin-top:20px;}td{padding:10px;border:1px solid #ddd;}.total{font-weight:bold;font-size:1.2rem;color:#4f46e5;}</style></head><body><h1>PRESUPUESTO - TECNIYA</h1><p><strong>Profesional:</strong> ${proName}</p><p><strong>Cliente:</strong> ${client}</p><p><strong>Fecha:</strong> ${date}</p><hr><h3>Descripción del trabajo</h3><p>${desc}</p><table><tr><td>Mano de obra</td><td class="total">$${price}</td></tr></table><br><p style="font-size:0.8rem;color:#999;">Presupuesto generado por TECNIYA · Aplicación creada por AFM Solutions</p></body></html>`;
  
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

export function sendBudgetWhatsApp() {
  const client = document.getElementById('budget-client')?.value;
  const desc = document.getElementById('budget-desc')?.value;
  const price = document.getElementById('budget-price')?.value;
  const proName = store.currentUser?.user_metadata?.full_name || 'Profesional';
  
  const msg = encodeURIComponent(`Hola ${client}! Soy ${proName} de TECNIYA.\n\nPresupuesto para: ${desc}\nPrecio: $${price}\n\n¿Te parece bien? Podemos coordinar fecha y hora.`);
  
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}
