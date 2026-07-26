import { PixelButton, PixelModal } from '../../components/ui';
import { freeCopies, loadoutCategoryMul } from '../../core/equip';
import { CATEGORY_META, CATEGORY_ORDER } from '../../data/devPhrases';
import { jobTitleOf } from '../../core/skills';
import {
  DEFAULT_LOADOUT,
  EQUIPMENT_BY_ID,
  type EquipLoadout,
  type EquipmentDef,
  type EquipSlot,
  ITEMS_BY_SLOT,
} from '../../data/equipment';
import { useGameStore } from '../../state/gameStore';
import { formatYen } from '../../utils/format';
import { formatSkills } from './employeeDisplay';

const SLOT_LABEL: Record<EquipSlot, string> = { pc: 'PC', chair: 'チェア', misc: '小物' };
const SLOTS: EquipSlot[] = ['pc', 'chair', 'misc'];

/** 装備のカテゴリ倍率を「プログラム+20%」形式の短文に。 */
const boostText = (def: EquipmentDef): string => {
  if (!def.categoryMul) return '効果なし';
  const parts = CATEGORY_ORDER.filter((c) => def.categoryMul?.[c]).map((c) => {
    const pct = Math.round(((def.categoryMul?.[c] ?? 1) - 1) * 100);
    return `${CATEGORY_META[c].label}+${pct}%`;
  });
  return parts.length ? parts.join(' ') : '効果なし';
};

/** 社員の現在装備の合計カテゴリ倍率を「プログラム×1.20」形式で。効果なしは null。 */
const equipMulText = (loadout: EquipLoadout): string | null => {
  const m = loadoutCategoryMul(loadout);
  const parts = CATEGORY_ORDER.filter((c) => m[c] > 1).map(
    (c) => `${CATEGORY_META[c].label}×${m[c].toFixed(2)}`,
  );
  return parts.length ? parts.join('　') : null;
};

/**
 * v0.25 装備モーダル：左=ショップ（購入）／右=在籍社員のスロット割当。
 * 実体方式（1個=1社員ぶん・複数欲しければ複数購入）。1280×720 内・スクロール回避のため 2 カラム＋コンパクト。
 * 配色：本体は明色地(#e0dfda)なので直載りの文字は暗色、暗いカード(#24395c)内は明色。
 */
export const EquipmentModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const funds = useGameStore((s) => s.funds);
  const employees = useGameStore((s) => s.employees);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const buyEquipment = useGameStore((s) => s.buyEquipment);
  const equipItem = useGameStore((s) => s.equipItem);

  const loadouts = employees.map((e) => e.equipped ?? {});

  return (
    <PixelModal open={open} onClose={onClose} title="🛠 装備（設備）" maxWidth={940}>
      <div style={{ display: 'flex', gap: 12, color: '#1c2228' }}>
        {/* ===== ショップ ===== */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={headingStyle}>ショップ　所持金 {formatYen(funds)}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SLOTS.map((slot) => (
              <div key={slot}>
                <div style={slotHeadStyle}>【{SLOT_LABEL[slot]}】</div>
                <ul style={listStyle}>
                  {ITEMS_BY_SLOT[slot]
                    .filter((def) => def.cost > 0) // 初期装備（cost0）は買う対象外
                    .map((def) => {
                      const count = ownedItems[def.id] ?? 0;
                      const free = freeCopies(ownedItems, loadouts, def.id);
                      const afford = funds >= def.cost;
                      return (
                        <li key={def.id} style={rowStyle}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#f0f3f8' }}>
                              {def.name}
                              {count > 0 && (
                                <span style={countTagStyle}>
                                  所有{count}・空き{free}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#9cc8ff' }}>{boostText(def)}</div>
                          </div>
                          <span style={{ fontSize: 11, color: '#ffe08a', whiteSpace: 'nowrap' }}>
                            {formatYen(def.cost)}
                          </span>
                          <PixelButton
                            size="small"
                            variant={afford ? 'primary' : 'secondary'}
                            disabled={!afford}
                            onClick={() => buyEquipment(def.id)}
                          >
                            購入
                          </PixelButton>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ===== 割当 ===== */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={headingStyle}>社員に装備</h3>
          {employees.length === 0 ? (
            <p style={{ fontSize: 12, color: '#6b7684' }}>社員がいません（採用してください）。</p>
          ) : (
            <ul style={{ ...listStyle, gap: 8 }}>
              {employees.map((e) => (
                <li
                  key={e.id}
                  style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={roleTagStyle}>{jobTitleOf(e.skills)}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#f0f3f8' }}>
                      {e.name}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#cbd6e6' }}>
                      Lv{e.level}・{formatSkills(e.skills)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SLOTS.map((slot) => {
                      const current = e.equipped?.[slot] ?? DEFAULT_LOADOUT[slot];
                      // 選べるのは「初期装備」＋（空きがある or 今この社員が着けている）所有アイテム
                      const owned = ITEMS_BY_SLOT[slot].filter(
                        (d) => d.cost > 0 && (ownedItems[d.id] ?? 0) > 0,
                      );
                      const selectable = owned.filter(
                        (d) => d.id === current || freeCopies(ownedItems, loadouts, d.id) > 0,
                      );
                      const options = [EQUIPMENT_BY_ID[DEFAULT_LOADOUT[slot]], ...selectable];
                      return (
                        <label key={slot} style={{ flex: 1, minWidth: 0, fontSize: 10 }}>
                          <span style={{ color: '#9cc8ff' }}>{SLOT_LABEL[slot]}</span>
                          <select
                            value={current}
                            onChange={(ev) => equipItem(e.id, slot, ev.target.value)}
                            style={selectStyle}
                          >
                            {options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: '#a9e6c0', minHeight: 12 }}>
                    {equipMulText(e.equipped ?? {})
                      ? `装備効果 ${equipMulText(e.equipped ?? {})}`
                      : '装備効果 なし'}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 10, color: '#6b7684', marginTop: 8 }}>
            ※装備は1個＝1人ぶん。打った作業カテゴリの品質を底上げします（効果は上限付き）。
          </p>
        </div>
      </div>
    </PixelModal>
  );
};

const headingStyle: React.CSSProperties = {
  fontSize: 13,
  margin: '0 0 8px',
  paddingBottom: 4,
  borderBottom: '2px solid #b7b4a9',
  color: '#1c2228',
};
const slotHeadStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#1a3a66',
  fontWeight: 700,
  marginBottom: 3,
};
const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  background: '#24395c',
  border: '2px solid #0a1422',
  borderRadius: 2,
};
const countTagStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 10,
  fontWeight: 400,
  color: '#a9e6c0',
};
const roleTagStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 6px',
  background: '#0f1d33',
  color: '#ffffff',
  borderRadius: 2,
};
const selectStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 11,
  padding: '2px 4px',
  background: '#0f1d33',
  color: '#f0f3f8',
  border: '2px solid #0a1422',
  borderRadius: 2,
};
