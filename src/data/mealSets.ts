import type { MealSet } from '../types/recipe'

/** Mâm cơm gia đình và bàn nhậu dựng sẵn — mỗi mâm là một tổ hợp món đã cân đối mặn, canh, rau. */
export const MEAL_SETS: MealSet[] = [
  {
    id: 'mam-bac-mua-he', title: 'Mâm Bắc ngày hè', emoji: '🦀', kind: 'com', region: 'bac',
    description: 'Canh cua mát lành, thịt luộc, cà pháo giòn tan và đĩa trứng chiên — mâm cơm mùa hè kinh điển.',
    dishes: ['canh-cua-rau-day', 'thit-luoc', 'ca-phao-muoi', 'trung-chien-hanh'],
    extras: ['Cơm trắng', 'Mắm tép hoặc nước mắm tỏi ớt'], goodFor: ['nong', 'mat'],
  },
  {
    id: 'mam-bac-ngay-mua', title: 'Mâm Bắc ngày mưa', emoji: '🌧️', kind: 'com', region: 'bac',
    description: 'Thịt rang cháy cạnh thơm nức, đậu sốt cà chua, bắp cải luộc và bát canh cà chua trứng nóng hổi.',
    dishes: ['thit-rang-chay-canh', 'dau-sot-ca-chua', 'bap-cai-luoc', 'canh-ca-chua-trung'],
    extras: ['Cơm trắng'], goodFor: ['mua', 'lanh'],
  },
  {
    id: 'mam-nam-ca-kho', title: 'Mâm miền Tây: cá kho – canh chua', emoji: '🐟', kind: 'com', region: 'nam',
    description: 'Cặp bài trùng cá lóc kho tộ và canh chua, thêm dĩa dưa giá chống ngấy.',
    dishes: ['ca-loc-kho-to', 'canh-chua-ca-loc', 'dua-gia'],
    extras: ['Cơm trắng', 'Nước mắm dằm ớt'], goodFor: ['mat', 'mua', 'nong'],
  },
  {
    id: 'mam-nam-thit-kho', title: 'Mâm Nam: thịt kho – khổ qua', emoji: '🥚', kind: 'com', region: 'nam',
    description: 'Thịt kho tàu béo mềm đi cùng canh khổ qua nhồi thịt thanh mát và dưa giá giòn chua.',
    dishes: ['thit-kho-tau', 'canh-kho-qua-nhoi-thit', 'dua-gia', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng'], goodFor: ['mat', 'lanh', 'nong'],
  },
  {
    id: 'mam-trung-ca-nuc', title: 'Mâm miền Trung đậm đà', emoji: '🌶️', kind: 'com', region: 'trung',
    description: 'Cá nục kho cay mặn mà, canh rau ngót ngọt mát, đĩa rau muống xào tỏi.',
    dishes: ['ca-nuc-kho', 'canh-rau-ngot-thit-bam', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng'], goodFor: ['mua', 'lanh', 'mat'],
  },
  {
    id: 'mam-tom-rim', title: 'Mâm tôm rim thịt', emoji: '🦐', kind: 'com', region: 'trung',
    description: 'Tôm rim thịt đỏ au đưa cơm, canh rau ngót thịt băm và bắp cải luộc chấm trứng.',
    dishes: ['tom-rim-thit', 'canh-rau-ngot-thit-bam', 'bap-cai-luoc'],
    extras: ['Cơm trắng'], goodFor: ['mat', 'mua', 'lanh'],
  },
  {
    id: 'mam-nhanh-30-phut', title: 'Mâm nhanh 30 phút', emoji: '⚡', kind: 'com', region: 'nam',
    description: 'Đi làm về muộn vẫn có mâm cơm nóng: bò xào hành tây, canh cà chua trứng, rau muống xào tỏi.',
    dishes: ['bo-xao-hanh-tay', 'canh-ca-chua-trung', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng'], goodFor: ['mat', 'nong', 'mua', 'lanh'],
  },
  {
    id: 'mam-thanh-dam', title: 'Mâm thanh đạm cho bé và ông bà', emoji: '👵', kind: 'com', region: 'trung',
    description: 'Gà kho gừng mềm, canh bầu nấu tôm ngọt mát, cải thìa xào nấm ít dầu — dễ ăn, dễ tiêu.',
    dishes: ['ga-kho-gung', 'canh-bau-nau-tom', 'cai-thia-xao-nam'],
    extras: ['Cơm trắng nấu mềm', 'Chuối hoặc trái cây tráng miệng'], goodFor: ['mat', 'mua', 'lanh', 'nong'],
  },
  {
    id: 'mam-suon-chua-ngot', title: 'Mâm sườn xào chua ngọt', emoji: '🍖', kind: 'com', region: 'bac',
    description: 'Sườn chua ngọt bóng bẩy, canh ngao nấu chua và rau muống xào — trẻ con ăn hết veo.',
    dishes: ['suon-xao-chua-ngot', 'canh-ngao-chua', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng'], goodFor: ['nong', 'mat'],
  },
  {
    id: 'mam-ca-chien', title: 'Mâm cá chiên sốt cà', emoji: '🍅', kind: 'com', region: 'nam',
    description: 'Cá chiên sốt cà đậm đà, canh rau ngót thịt băm, thêm chén cà pháo giòn.',
    dishes: ['ca-chien-sot-ca', 'canh-rau-ngot-thit-bam', 'ca-phao-muoi'],
    extras: ['Cơm trắng'], goodFor: ['mat', 'nong', 'mua'],
  },
  {
    id: 'mam-cha-la-lot', title: 'Mâm chả lá lốt', emoji: '🍃', kind: 'com', region: 'bac',
    description: 'Chả lá lốt thơm lừng, đậu phụ sốt cà chua và canh cua rau đay.',
    dishes: ['cha-la-lot', 'dau-sot-ca-chua', 'canh-cua-rau-day'],
    extras: ['Cơm trắng', 'Nước mắm tỏi ớt'], goodFor: ['mat', 'nong', 'mua'],
  },
  {
    id: 'mam-healthy', title: 'Mâm ít dầu mỡ', emoji: '🥗', kind: 'com', region: 'trung',
    description: 'Gỏi gà xé phay, canh bầu nấu tôm, cải thìa xào nấm — nhẹ bụng mà vẫn đủ chất.',
    dishes: ['goi-ga-xe-phay', 'canh-bau-nau-tom', 'cai-thia-xao-nam'],
    extras: ['Cơm gạo lứt hoặc cơm trắng'], goodFor: ['nong', 'mat'],
  },
  {
    id: 'mam-ngay-lanh', title: 'Mâm ấm bụng ngày lạnh', emoji: '🧣', kind: 'com', region: 'trung',
    description: 'Bò kho mật mía cay ấm, canh sườn hầm rau củ nóng hổi, bắp cải luộc chấm trứng.',
    dishes: ['bo-kho-mat-mia', 'canh-suon-rau-cu', 'bap-cai-luoc'],
    extras: ['Cơm trắng'], goodFor: ['lanh', 'mua'],
  },
  {
    id: 'mam-hai-san', title: 'Mâm hải sản nhẹ nhàng', emoji: '🦑', kind: 'com', region: 'nam',
    description: 'Mực xào thơm cà giòn ngọt, canh ngao nấu chua và rau muống xào tỏi.',
    dishes: ['muc-xao-thom', 'canh-ngao-chua', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng'], goodFor: ['nong', 'mat'],
  },
  {
    id: 'mam-ga-sa-ot', title: 'Mâm gà xào sả ớt', emoji: '🍗', kind: 'com', region: 'nam',
    description: 'Gà xào sả ớt cay thơm, canh chua cá lóc giải ngấy, dưa giá giòn mát.',
    dishes: ['ga-xao-sa-ot', 'canh-chua-ca-loc', 'dua-gia'],
    extras: ['Cơm trắng'], goodFor: ['mua', 'mat', 'lanh'],
  },
  {
    id: 'mam-kho-quet', title: 'Mâm dân dã kho quẹt', emoji: '🥦', kind: 'com', region: 'nam',
    description: 'Rau củ luộc chấm kho quẹt, trứng chiên hành và canh khổ qua — giản dị kiểu miền Tây.',
    dishes: ['rau-cu-luoc-kho-quet', 'trung-chien-hanh', 'canh-kho-qua-nhoi-thit'],
    extras: ['Cơm trắng hoặc cơm cháy'], goodFor: ['mua', 'mat', 'lanh'],
  },
  {
    id: 'mam-cuoi-tuan', title: 'Mâm cuối tuần đãi khách', emoji: '🎉', kind: 'com', region: 'nam',
    description: 'Bốn món cho bữa đông người: thịt kho tàu, gỏi gà xé phay, chả lá lốt và canh chua cá lóc.',
    dishes: ['thit-kho-tau', 'goi-ga-xe-phay', 'cha-la-lot', 'canh-chua-ca-loc'],
    extras: ['Cơm trắng', 'Trái cây tráng miệng'], goodFor: ['mat', 'nong', 'mua', 'lanh'],
  },
  {
    id: 'mam-trung-duc-thit', title: 'Mâm tuổi thơ', emoji: '🏡', kind: 'com', region: 'bac',
    description: 'Trứng đúc thịt, canh sườn hầm rau củ và đĩa rau muống xào tỏi — bữa cơm bà nấu.',
    dishes: ['trung-duc-thit', 'canh-suon-rau-cu', 'rau-muong-xao-toi'],
    extras: ['Cơm trắng', 'Cà pháo'], goodFor: ['lanh', 'mua', 'mat'],
  },
  {
    id: 'ban-nhau-de-lam', title: 'Bàn nhậu dễ làm tại nhà', emoji: '🍻', kind: 'nhau', region: 'nam',
    description: 'Bốn mồi làm trong một tiếng: đậu phộng rang tỏi ớt khai vị, nghêu hấp sả, cánh gà chiên nước mắm, gỏi xoài.',
    dishes: ['dau-phong-rang-toi-ot', 'ngheu-hap-sa', 'canh-ga-chien-nuoc-mam', 'goi-xoai-kho-ca-sac'],
    extras: ['Bia ướp lạnh', 'Đá viên', 'Rau răm, chanh ớt'], goodFor: ['mua', 'mat', 'nong'],
  },
  {
    id: 'ban-nhau-hai-san', title: 'Bàn nhậu hải sản', emoji: '🦐', kind: 'nhau', region: 'trung',
    description: 'Mực hấp gừng sả, tôm nướng muối ớt, nghêu hấp sả và đậu hũ chiên sả ớt cho người không ăn hải sản.',
    dishes: ['muc-hap-gung', 'tom-nuong-muoi-ot', 'ngheu-hap-sa', 'dau-hu-chien-sa-ot'],
    extras: ['Bia hoặc vang trắng lạnh', 'Muối tiêu chanh'], goodFor: ['nong', 'mat', 'mua'],
  },
  {
    id: 'ban-nhau-ngay-mua', title: 'Bàn nhậu ngày mưa', emoji: '🔥', kind: 'nhau', region: 'bac',
    description: 'Đồ nướng, đồ rán nóng giòn: ba chỉ nướng sa tế, nem chua rán, sụn gà rang muối và chân gà sả tắc giải ngấy.',
    dishes: ['ba-chi-nuong-sa-te', 'nem-chua-ran', 'sun-ga-rang-muoi', 'chan-ga-sa-tac'],
    extras: ['Bia lạnh', 'Rau sống cuốn thịt', 'Kim chi'], goodFor: ['mua', 'lanh'],
  },
]
