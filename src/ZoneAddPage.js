import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ZoneAddPage.css';

// Leaflet 기본 마커 아이콘 설정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const RADIUS_OPTIONS = [
  { label: '100m', value: 100 },
  { label: '200m', value: 200 },
  { label: '300m', value: 300 },
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
];

const MAX_NOTE_LENGTH = 300;

// 띄어쓰기 유무 모두 커버하는 검색 변형 생성
// 예: "조원로 12길" → ["조원로 12길", "조원로12길"]
//     "조원로12길"  → ["조원로12길",  "조원로 12길"]
const getSearchVariants = (query) => {
  const base = query.trim();
  const variants = [base];
  // 한글/영문자와 숫자 사이 공백 제거: "조원로 12길" → "조원로12길"
  const noSpace = base.replace(/([가-힣a-zA-Z])\s+(\d)/g, '$1$2');
  // 한글/영문자와 숫자 사이 공백 추가: "조원로12길" → "조원로 12길"
  const withSpace = base.replace(/([가-힣a-zA-Z])(\d)/g, '$1 $2');
  if (noSpace !== base) variants.push(noSpace);
  if (withSpace !== base) variants.push(withSpace);
  return [...new Set(variants)];
};

// 지도 중심 이동 컴포넌트 (검색/이동 시에만 flyTo 실행)
function FlyTo({ position, shouldFly }) {
  const map = useMap();
  useEffect(() => {
    if (shouldFly && position) {
      map.flyTo(position, 16, { duration: 1.2 });
    }
  }, [position, shouldFly, map]);
  return null;
}

// 지도 클릭 이벤트 컴포넌트
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

// 현재 위치로 이동 버튼 컴포넌트
function LocateButton({ onLocate }) {
  const map = useMap();
  const handleClick = () => {
    map.locate({ setView: true, maxZoom: 16 });
    map.once('locationfound', (e) => {
      onLocate(e.latlng);
    });
    map.once('locationerror', () => {
      alert('위치 정보를 가져올 수 없습니다.');
    });
  };
  return (
    <button className="locate-btn" onClick={handleClick} title="현재 위치로 이동">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="1" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="1" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="23" y2="12" />
      </svg>
    </button>
  );
}

export default function ZoneAddPage() {
  const [zoneName, setZoneName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [note, setNote] = useState('');
  const [radius, setRadius] = useState(100);
  const [markerPos, setMarkerPos] = useState({ lat: 37.5665, lng: 126.978 }); // 서울 기본
  const [shouldFly, setShouldFly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [zones, setZones] = useState([]);


  const handleAddressSearch = async () => {
    if (!addressInput.trim()) return;

    setIsSearching(true);
    setSearchError('');

    try {
      const variants = getSearchVariants(addressInput);
      let found = null;

      // 변형 쿼리를 순서대로 시도, 첫 번째 결과 사용
      for (const variant of variants) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(variant)}&format=json&limit=1&accept-language=ko`,
          { headers: { 'Accept-Language': 'ko' } }
        );
        const data = await res.json();
        if (data && data.length > 0) {
          found = data[0];
          break;
        }
      }

      if (found) {
        const newPos = { lat: parseFloat(found.lat), lng: parseFloat(found.lon) };
        setMarkerPos(newPos);
        setShouldFly(true);
      } else {
        setSearchError('주소를 찾을 수 없습니다. 다시 입력해주세요.');
      }
    } catch (e) {
      setSearchError('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddressSearch();
  };

  const reverseGeocode = async (lat, lng) => {
    setIsReverseGeocoding(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko`,
        { headers: { 'Accept-Language': 'ko' } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddressInput(data.display_name);
      }
    } catch (e) {
      setSearchError('주소 변환 중 오류가 발생했습니다.');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleMapClick = (latlng) => {
    setMarkerPos(latlng);
    setShouldFly(false);
    reverseGeocode(latlng.lat, latlng.lng);
  };

  const handleLocate = (latlng) => {
    setMarkerPos(latlng);
    setShouldFly(true);
    reverseGeocode(latlng.lat, latlng.lng);
  };

  const handleCancel = () => {
    setZoneName('');
    setAddressInput('');
    setNote('');
    setRadius(100);
    setSearchError('');
  };

  const handleAdd = () => {
    if (!zoneName.trim()) {
      alert('구역 이름을 입력해주세요.');
      return;
    }
    const newZone = {
      id: Date.now(),
      name: zoneName.trim(),
      lat: markerPos.lat,
      lng: markerPos.lng,
      radius,
      address: addressInput,
    };
    setZones((prev) => [...prev, newZone]);
    setZoneName('');
    setAddressInput('');
    setNote('');
    setRadius(100);
    setSearchError('');
  };

  const handleZoneClick = (zone) => {
    setMarkerPos({ lat: zone.lat, lng: zone.lng });
    setRadius(zone.radius);
    setAddressInput(zone.address);
    setShouldFly(true);
  };

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h1>구역 추가</h1>
        <div className="header-controls">
          <button className="btn-icon yellow">&#9679;</button>
          <button className="btn-icon green">&#9679;</button>
          <button className="btn-icon red">&#10005;</button>
        </div>
      </div>

      <div className="zone-body">
        {/* 왼쪽: 지도 */}
        <div className="map-section">
          <MapContainer
            center={[markerPos.lat, markerPos.lng]}
            zoom={14}
            className="leaflet-map"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo position={[markerPos.lat, markerPos.lng]} shouldFly={shouldFly} />
            <MapClickHandler onClick={handleMapClick} />
            <LocateButton onLocate={handleLocate} />
            <Marker position={[markerPos.lat, markerPos.lng]} />
            <Circle
              center={[markerPos.lat, markerPos.lng]}
              radius={radius}
              pathOptions={{ color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 0.15, weight: 2 }}
            />
          </MapContainer>
          <div className="coords-bar">
            위도 · 경도 : {markerPos.lat.toFixed(15)}, {markerPos.lng.toFixed(15)}
          </div>
        </div>

        {/* 구분선 */}
        <div className="divider" />

        {/* 오른쪽: 폼 */}
        <div className="form-section">
          {/* 구역 이름 */}
          <div className="form-group">
            <label className="form-label">구역 이름</label>
            <input
              type="text"
              className="form-input"
              placeholder="Text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
            />
          </div>

          {/* 구역 주소 */}
          <div className="form-group">
            <label className="form-label">구역 주소</label>
            <div className="address-row">
              <div className="search-input-wrap">
                <span className="search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="form-input search-input"
                  placeholder={isReverseGeocoding ? '주소 불러오는 중...' : '장소명/ 주소 검색 또는 지도를 클릭하세요'}
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isReverseGeocoding}
                  readOnly={isReverseGeocoding}
                />
              </div>
              <button
                className="btn-change"
                onClick={handleAddressSearch}
                disabled={isSearching || isReverseGeocoding}
              >
                {isSearching ? '검색 중...' : isReverseGeocoding ? '주소 확인 중...' : '주소 변경'}
              </button>
            </div>
            {searchError && <p className="error-text">{searchError}</p>}
          </div>

          {/* 반경 범위 선택 */}
          <div className="form-group">
            <label className="form-label">반경 범위 선택</label>
            <div className="select-wrap">
              <select
                className="form-select"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 비고 */}
          <div className="form-group">
            <label className="form-label">비고</label>
            <textarea
              className="form-textarea"
              placeholder="Text"
              value={note}
              onChange={(e) => {
                if (e.target.value.length <= MAX_NOTE_LENGTH) setNote(e.target.value);
              }}
            />
            <span className="char-count">{note.length}/{MAX_NOTE_LENGTH}</span>
          </div>

          {/* 추가된 구역 목록 */}
          {zones.length > 0 && (
            <div className="form-group">
              <label className="form-label">추가된 구역</label>
              <div className="zone-list">
                {zones.map((zone) => (
                  <div key={zone.id} className="zone-tag">
                    <button
                      className="btn-zone-ghost"
                      onClick={() => handleZoneClick(zone)}
                      title={zone.address || zone.name}
                    >
                      {zone.name}
                    </button>
                    <button
                      className="btn-zone-delete"
                      onClick={() => setZones((prev) => prev.filter((z) => z.id !== zone.id))}
                      title="구역 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="form-actions">
            <button className="btn-cancel" onClick={handleCancel}>취소</button>
            <button className="btn-add" onClick={handleAdd}>추가</button>
          </div>
        </div>
      </div>
    </div>
  );
}
