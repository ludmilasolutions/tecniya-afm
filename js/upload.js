import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast } from './ui.js';

const BUCKETS = {
  AVATARS: 'avatars',
  WORK_PHOTOS: 'work-photos',
  CERTIFICATIONS: 'certifications',
  ADS: 'ads'
};

export async function initStorage() {
  console.log('Storage initialized - buckets must be created manually in Supabase Dashboard');
}

export async function uploadAvatar(file, userId) {
  const sb = getSupabase();
  
  if (!file || !userId) {
    showToast('Archivo o usuario no válido', 'error');
    return null;
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/avatar.${fileExt}`;
  const filePath = `${BUCKETS.AVATARS}/${fileName}`;

  const { data, error } = await sb.storage
    .from(BUCKETS.AVATARS)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) {
    showToast('Error al subir avatar: ' + error.message, 'error');
    return null;
  }

  const { data: { publicUrl } } = sb.storage
    .from(BUCKETS.AVATARS)
    .getPublicUrl(filePath);

  await sb.from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);

  showToast('Avatar actualizado', 'success');
  return publicUrl;
}

export async function uploadWorkPhoto(file, professionalId, title = '', description = '') {
  const sb = getSupabase();
  
  if (!file || !professionalId) {
    showToast('Archivo o profesional no válido', 'error');
    return null;
  }

  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop();
  const fileName = `${professionalId}/${timestamp}.${fileExt}`;
  const filePath = `${BUCKETS.WORK_PHOTOS}/${fileName}`;

  const { data, error } = await sb.storage
    .from(BUCKETS.WORK_PHOTOS)
    .upload(filePath, file, {
      contentType: file.type
    });

  if (error) {
    showToast('Error al subir foto: ' + error.message, 'error');
    return null;
  }

  const { data: { publicUrl } } = sb.storage
    .from(BUCKETS.WORK_PHOTOS)
    .getPublicUrl(filePath);

  const { data: photo, error: dbError } = await sb
    .from('work_photos')
    .insert({
      professional_id: professionalId,
      title,
      description,
      photo_url: publicUrl,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (dbError) {
    showToast('Error al guardar registro: ' + dbError.message, 'error');
    return null;
  }

  showToast('Foto subida correctamente', 'success');
  return photo;
}

export async function deleteWorkPhoto(photoId, photoUrl) {
  const sb = getSupabase();
  
  const fileName = photoUrl.split('/').pop();
  const filePath = `${BUCKETS.WORK_PHOTOS}/${fileName}`;

  await sb.storage
    .from(BUCKETS.WORK_PHOTOS)
    .remove([filePath]);

  await sb
    .from('work_photos')
    .delete()
    .eq('id', photoId);

  showToast('Foto eliminada', 'success');
}

export async function uploadCertification(file, professionalId, name, issuer = '', expiryDate = null) {
  const sb = getSupabase();
  
  if (!file || !professionalId || !name) {
    showToast('Datos incompletos', 'error');
    return null;
  }

  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop();
  const fileName = `${professionalId}/${timestamp}.${fileExt}`;
  const filePath = `${BUCKETS.CERTIFICATIONS}/${fileName}`;

  const { data, error } = await sb.storage
    .from(BUCKETS.CERTIFICATIONS)
    .upload(filePath, file, {
      contentType: file.type
    });

  if (error) {
    showToast('Error al subir certificación: ' + error.message, 'error');
    return null;
  }

  const { data: { publicUrl } } = sb.storage
    .from(BUCKETS.CERTIFICATIONS)
    .getPublicUrl(filePath);

  const { data: cert, error: dbError } = await sb
    .from('certifications')
    .insert({
      professional_id: professionalId,
      name,
      issuer,
      expiry_date: expiryDate,
      document_url: publicUrl,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (dbError) {
    showToast('Error al guardar: ' + dbError.message, 'error');
    return null;
  }

  showToast('Certificación subida. Pendiente de verificación.', 'success');
  return cert;
}

export async function deleteCertification(certId, certUrl) {
  const sb = getSupabase();
  
  if (certUrl) {
    const fileName = certUrl.split('/').pop();
    const filePath = `${BUCKETS.CERTIFICATIONS}/${fileName}`;
    
    await sb.storage
      .from(BUCKETS.CERTIFICATIONS)
      .remove([filePath]);
  }

  await sb
    .from('certifications')
    .delete()
    .eq('id', certId);

  showToast('Certificación eliminada', 'success');
}

export async function uploadAdImage(file) {
  const sb = getSupabase();
  
  if (!file) {
    showToast('Archivo no válido', 'error');
    return null;
  }

  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop();
  const fileName = `ads/${timestamp}.${fileExt}`;
  const filePath = `${BUCKETS.ADS}/${fileName}`;

  const { data, error } = await sb.storage
    .from(BUCKETS.ADS)
    .upload(filePath, file, {
      contentType: file.type
    });

  if (error) {
    showToast('Error al subir imagen: ' + error.message, 'error');
    return null;
  }

  const { data: { publicUrl } } = sb.storage
    .from(BUCKETS.ADS)
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function loadWorkPhotos(professionalId) {
  const sb = getSupabase();
  
  const { data, error } = await sb
    .from('work_photos')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function loadCertifications(professionalId) {
  const sb = getSupabase();
  
  const { data, error } = await sb
    .from('certifications')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false });

  return data || [];
}

export function createImagePreview(file, callback) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    callback(e.target.result);
  };
  
  reader.readAsDataURL(file);
}

export function validateFile(file, options = {}) {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']
  } = options;

  if (!file) {
    return { valid: false, error: 'No se seleccionó archivo' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `El archivo supera el tamaño máximo de ${maxSize / 1024 / 1024}MB` };
  }

  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Tipo de archivo no permitido' };
  }

  return { valid: true };
}

export function initUploadEvents() {
  const avatarInput = document.getElementById('avatar-upload');
  if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const validation = validateFile(file);
      
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }

      if (store.currentUser) {
        await uploadAvatar(file, store.currentUser.id);
      }
    });
  }

  const photoInput = document.getElementById('work-photo-upload');
  if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const validation = validateFile(file);
      
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }

      if (store.currentPro) {
        await uploadWorkPhoto(file, store.currentPro.id);
      }
    });
  }

  const certInput = document.getElementById('cert-upload');
  if (certInput) {
    certInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const validation = validateFile(file, { 
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']
      });
      
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }

      const name = document.getElementById('cert-name')?.value;
      const issuer = document.getElementById('cert-issuer')?.value;
      
      if (store.currentPro && name) {
        await uploadCertification(file, store.currentPro.id, name, issuer);
      }
    });
  }
}
