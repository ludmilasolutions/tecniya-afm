import { store } from './store.js';
import { showToast } from './ui.js';

export function detectLocation() {
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización', 'error');
    return;
  }
  
  showToast('Detectando ubicación...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    position => {
      store.setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      showToast('Ubicación detectada correctamente', 'success');
    },
    error => {
      showToast('No se pudo detectar la ubicación', 'error');
      console.error('Geolocation error:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

export function getUserLocation() {
  return store.userLocation;
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

export function sortByDistance(pros, userLocation) {
  if (!userLocation) return pros;
  
  return [...pros].sort((a, b) => {
    const distA = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      a.lat || 0,
      a.lng || 0
    );
    const distB = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      b.lat || 0,
      b.lng || 0
    );
    return distA - distB;
  });
}

export function filterByDistance(pros, maxDistance, userLocation) {
  if (!userLocation || !maxDistance) return pros;
  
  return pros.filter(p => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      p.lat || 0,
      p.lng || 0
    );
    return distance <= maxDistance;
  });
}

const CITIES_BY_PROVINCE = {
  'Buenos Aires': ['La Plata','Mar del Plata','Quilmes','Avellaneda','Lanús','Morón','San Martín','José C. Paz','Hurlingham','Tigre','San Isidro','Vicente López','Bahía Blanca','Necochea','Olavarría','Junín','Chivilcoy','Mercedes','Chascomús','Zárate'],
  'Córdoba': ['Córdoba','Villa María','Río Cuarto','San Francisco','Alta Gracia','Bell Ville','Villa General Belgrano','Mina Clavero','Cosquín','La Falda','Carlos Paz','Jesús María','Colón','Unquillo','Mendiolaza'],
  'Santa Fe': ['Rosario','Santa Fe','Rafaela','Venado Tuerto','San Lorenzo','Reconquista','Santo Tomé','Esperanza','Sunchales','Cañada de Gómez','Firmat','Casilda','Arroyo Seco','Villa Ocampo'],
  'Mendoza': ['Mendoza','Godoy Cruz','Guaymallén','Maipú','San Rafael','Luján de Cuyo','Tupungato','San Martín','Rivadavia','General Alvear','Malargüe','Las Heras','La Paz','Santa Rosa'],
  'Tucumán': ['San Miguel de Tucumán','Tafí Viejo','Bella Vista','Concepción','Aguilar','Monteros','Famaillá','Simoca','Burruyacú','Trancas','La Cocha','Graneros','Chicligasta','Rio Chico'],
  'Salta': ['Salta','San Ramón de la Nueva Orán','Tartagal','Cachi','Cafayate','La Poma','Molinos','San Antonio de los Cobres','Los Andes','Santa Victoria'],
  'Neuquén': ['Neuquén','Plottier','Cipolletti','San Martín de los Andes','Villa La Angostura','Zapala','Chos Malal','Junín de los Andes','Loncopué','Añelo'],
  'Entre Ríos': ['Paraná','Concordia','Gualeguaychú','Concepción del Uruguay','La Paz','Villaguay','Diamante','Nogoyá','Victoria','San Salvador','Federación','Feliciano'],
  'Chaco': ['Resistencia','Presidencia Roque Sáenz Peña','Charata','Villa Ángela','San Bernardo','Quitilipi','Campo Largo','Las Breñas','Corzuela','Fachinal'],
  'Corrientes': ['Corrientes','Goya','Bella Vista','Mercedes','Santo Tomé','Curuzú Cuatiá','Paso de los Libres','Esquina','Monte Caseros','Sauce'],
  'Misiones': ['Posadas','Puerto Iguazú','Oberá','Eldorado','San Vicente','Jardín América','Aristóbulo del Valle','Leandro N. Alem','Puerto Rico','Campo Grande'],
  'Formosa': ['Formosa','Clorinda','El Colorado','Pirané','Ingeniero Juárez','Las Lomitas','Comandante Fontana','San Martín II','Ibarreta','Laguna Yema'],
  'Jujuy': ['San Salvador de Jujuy','San Pedro','Libertador General San Martín','La Quiaca','Humahuaca','Tilcara','Mina Pirquitas','Palpalá','Perico','El Carmen'],
  'La Pampa': ['Santa Rosa','General Pico','Toay','Realicó','Victorica','Macachín','General Acha','Intendente Alvear','Gral. José de San Martín','Winifreda'],
  'La Rioja': ['La Rioja','Chilecito','Famatan','Anillaco','Aimogasta','Olta','Villa Unión','San Blas de los Sauces','Chamical','Chepes'],
  'San Juan': ['San Juan','Rawson','Chimbas','Rivadavia','Pocito','Caucete','Albardón','Angaco','San Martín','9 de Julio'],
  'San Luis': ['San Luis','Villa Mercedes','Juana Koslay','La Punta','Potrero de los Funes','El Volcán','Cerro de la Cruz','Boca del Río','Cortaderas','Los Molles'],
  'Santiago del Estero': ['Santiago del Estero','La Banda','Termas de Río Hondo','Añatuya','Monte Quemado','Frías','Taboada','Loma Grande','El Hoyo','Icaño'],
  'Tierra del Fuego': ['Ushuaia','Río Grande','Tolhuin','Porvenir','San Sebastián','Río Turbio','5 de Octubre','Lago Argentino'],
  'Chubut': ['Rawson','Puerto Madryn','Comodoro Rivadavia','Trelew','Gaiman','Dolavon','Camarones','Puerto Pirámides','Sarmiento','Esquel'],
  'Río Negro': ['Viedma','Bariloche','Cipolletti','Río Colorado','Villa Regina','San Carlos de Bariloche','San Antonio Oeste','Los Menucos','Ingeniero Jacobacci','El Bolsón']
};

export function onActivateProvinceChange(province) {
  const citySelect = document.getElementById('activate-city');
  if (!citySelect) return;
  
  citySelect.innerHTML = '<option value="">Cargando...</option>';
  
  if (!province) {
    citySelect.innerHTML = '<option value="">Seleccioná una provincia primero</option>';
    return;
  }
  
  const cities = CITIES_BY_PROVINCE[province] || [];
  citySelect.innerHTML = '<option value="">Seleccioná tu ciudad</option>' + 
    cities.map(c => `<option value="${c}">${c}</option>`).join('');
}

export async function detectActivateLocation() {
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización', 'error');
    return;
  }
  
  showToast('Detectando ubicación...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    async position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Intentar obtener provincia y ciudad usando reverse geocoding gratuito
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        
        if (data.address) {
          const province = data.address.state || data.address.county || '';
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
          
          // Buscar provincia en lista
          const provinceKeys = Object.keys(CITIES_BY_PROVINCE);
          let matchedProvince = provinceKeys.find(p => province.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(province.toLowerCase()));
          
          if (matchedProvince) {
            const provinceSelect = document.getElementById('activate-province');
            if (provinceSelect) {
              provinceSelect.value = matchedProvince;
              onActivateProvinceChange(matchedProvince);
              
              // Seleccionar ciudad
              setTimeout(() => {
                const citySelect = document.getElementById('activate-city');
                if (citySelect && city) {
                  const cities = CITIES_BY_PROVINCE[matchedProvince] || [];
                  const matchedCity = cities.find(c => city.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(city.toLowerCase()));
                  if (matchedCity) {
                    citySelect.value = matchedCity;
                  }
                }
              }, 100);
            }
          }
          
          showToast('Ubicación detectada: ' + (city || provincia), 'success');
        }
      } catch (e) {
        console.error('Reverse geocoding error:', e);
        showToast('Ubicación detectada pero no se pudo obtener la ciudad', 'info');
      }
      
      store.setUserLocation({ lat, lng });
    },
    error => {
      showToast('No se pudo detectar la ubicación', 'error');
      console.error('Geolocation error:', error);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
