import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 - 주차별 20문제 세트 5개 (9~13주차)
// 객관식은 개념·기전·"옳은/틀린 것 고르기"를 섞었다.

const COMMON = { subject: '기타', grade: '기타' }

const sets = [
  {
    set: {
      id: 'set-immuno-w9',
      title: '면역학 9주차 - T세포 매개 면역',
      description:
        'CD4 아부류(Th1/Th2/Th17/Tfh)와 사이토카인, M1/M2 대식세포, Th 분화 전사인자, CTL 분화·교차제시, 두 가지 살상기전(perforin·granzyme / Fas-FasL), 미생물의 면역회피, T세포 고갈 등 핵심 20문제.',
      tags: ['면역학', '9주차', 'T세포', 'CTL', 'Th세포'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: 'T세포 매개 면역이 주로 방어하는 대상은?',
        options: ['세포 내 감염', '세포 외 독소', '점막 표면 부착균', '혈중 자유 항원'],
        answer: '세포 내 감염',
      },
      {
        type: 'CHOICE',
        question_text: 'CD8+ 세포독성 T세포(CTL)가 표적으로 삼는 미생물의 위치는?',
        options: [
          '감염 세포의 세포질',
          '대식세포의 소낭(포식소체) 내부',
          '혈장',
          '점막 내강',
        ],
        answer: '감염 세포의 세포질',
      },
      {
        type: 'OX',
        question_text:
          '세포 내 세균에 대한 방어는 항체가 아니라 T림프구에 의해 전달되며, 실제 세균 사멸은 T림프구가 활성화한 대식세포가 담당한다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '세포 내 병원체 방어를 담당하며 IFN-γ를 분비해 큰포식세포를 활성화하는 CD4 아부류는?',
        options: ['Th1', 'Th2', 'Th17', 'Tfh'],
        answer: 'Th1',
      },
      {
        type: 'CHOICE',
        question_text: '연충(기생충) 방어를 담당하며 IL-4·IL-5·IL-13을 분비하고 호산구·비만세포를 표적으로 하는 아부류는?',
        options: ['Th2', 'Th1', 'Th17', 'Tfh'],
        answer: 'Th2',
      },
      {
        type: 'CHOICE',
        question_text: '세포 외 세균·곰팡이 방어를 담당하며 IL-17·IL-22로 호중구를 동원하는 아부류는?',
        options: ['Th17', 'Th1', 'Th2', 'Tfh'],
        answer: 'Th17',
      },
      {
        type: 'CHOICE',
        question_text: 'Th1의 IFN-γ가 고전 경로로 큰포식세포를 활성화시켜 만들어지며 강력한 살균능(ROS·NO)을 갖는 대식세포는?',
        options: ['M1 큰포식세포', 'M2 큰포식세포', '비만세포', '수지상세포'],
        answer: 'M1 큰포식세포',
      },
      {
        type: 'CHOICE',
        question_text: '조직 회복·섬유증에 관여하는 M2 대체 큰포식세포 활성화를 유도하는 사이토카인 조합은?',
        options: ['IL-4 + IL-13 (Th2)', 'IFN-γ + CD40L (Th1)', 'IL-17 + IL-22', 'IL-1 + IL-6 + IL-23'],
        answer: 'IL-4 + IL-13 (Th2)',
      },
      {
        type: 'CHOICE',
        question_text: 'Th1 분화를 결정하는 핵심 전사인자는? (TCR + IL-12 + IFN-γ 신호가 함께 유도)',
        options: ['T-bet', 'GATA-3', 'RORγt', 'FOXP3'],
        answer: 'T-bet',
      },
      {
        type: 'CHOICE',
        question_text: 'Th1 분화 신호 중 IL-12가 활성화하는 전사인자는?',
        options: ['STAT4', 'STAT6', 'STAT3', 'STAT1'],
        answer: 'STAT4',
      },
      {
        type: 'CHOICE',
        question_text: '나병에서 면역 우세 아부류와 병형의 관계로 옳은 것은?',
        options: [
          'Th1 우세 → 결핵성 나병, Th2 우세 → 나종성 나병',
          'Th1 우세 → 나종성 나병, Th2 우세 → 결핵성 나병',
          'Th17 우세 → 결핵성 나병',
          'Tfh 우세 → 나종성 나병',
        ],
        answer: 'Th1 우세 → 결핵성 나병, Th2 우세 → 나종성 나병',
      },
      {
        type: 'CHOICE',
        question_text: 'Th17 분화에서 IL-6 또는 IL-1과 함께 존재하면 RORγt 발현을 유도하지만, 단독으로는 면역 저해제로 작용하는 인자는?',
        options: ['TGF-β', 'IFN-γ', 'IL-2', 'IL-4'],
        answer: 'TGF-β',
      },
      {
        type: 'CHOICE',
        question_text: 'Th17 세포의 선천성 결핍 시 나타나는 대표 질환은?',
        options: ['점막피부칸디다증', '건선', '염증성 장질환', '아토피 피부염'],
        answer: '점막피부칸디다증',
      },
      {
        type: 'CHOICE',
        question_text: '대식세포의 살균기작이 소낭에 국한되어 있어, 세포질의 바이러스나 빠져나온 세균을 제거하기 위해 CTL이 필요한 것이다. 이 설명으로 옳은 것은?',
        options: [
          'CTL은 세포질에 존재하는 병원체를 제거하기 위해 필요하다',
          'CTL은 소낭 내 병원체만 제거한다',
          'CTL은 항체를 분비하여 독소를 중화한다',
          'CTL은 보체를 활성화하여 균을 용해한다',
        ],
        answer: 'CTL은 세포질에 존재하는 병원체를 제거하기 위해 필요하다',
      },
      {
        type: 'CHOICE',
        question_text: '수지상세포가 감염 세포의 항원을 1형 MHC에 제시하여 CD8+ T세포를 활성화하는 과정을 무엇이라 하는가?',
        options: ['교차제시(cross-presentation)', '옵소닌화', '체세포 과돌연변이', '클래스전환'],
        answer: '교차제시(cross-presentation)',
      },
      {
        type: 'CHOICE',
        question_text: 'CTL의 perforin/granzyme 경로에서 granzyme의 작용으로 옳은 것은?',
        options: [
          'caspase를 절단·활성화하여 세포자멸사를 유도한다',
          '표적세포 막에 구멍을 낸다',
          '세포 내 미생물을 직접 사멸시킨다',
          'Fas에 결합하여 DISC를 형성한다',
        ],
        answer: 'caspase를 절단·활성화하여 세포자멸사를 유도한다',
      },
      {
        type: 'CHOICE',
        question_text: 'CTL의 Fas-FasL 경로가 perforin/granzyme 경로와 다른 점은?',
        options: [
          '접촉 의존적이며 과립 분비 없이 수용체-리간드 결합만으로 세포자멸사를 유도한다',
          '과립을 방향성 있게 분비하여 빠르게 작용한다',
          '미토콘드리아(내인성) 경로로 세포자멸사를 유도한다',
          '바이러스 감염 세포를 가장 신속하게 제거한다',
        ],
        answer: '접촉 의존적이며 과립 분비 없이 수용체-리간드 결합만으로 세포자멸사를 유도한다',
      },
      {
        type: 'CHOICE',
        question_text: '단순포진바이러스(HSV)가 CTL을 회피하는 기전은?',
        options: [
          'ICP47 단백질이 TAP를 차단해 펩티드의 ER 수송을 막아 MHC I-펩티드 복합체 형성을 저해',
          'IL-10을 생산해 T세포 반응을 억제',
          '용해성 사이토카인 수용체를 생산해 IFN-γ를 중화',
          '협막으로 식균작용을 차단',
        ],
        answer: 'ICP47 단백질이 TAP를 차단해 펩티드의 ER 수송을 막아 MHC I-펩티드 복합체 형성을 저해',
      },
      {
        type: 'OX',
        question_text:
          '바이러스가 CTL 회피를 위해 1형 MHC를 억제하면, 1형 MHC가 없는 세포를 NK세포가 인식하여 제거한다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'SHORT',
        question_text:
          '만성 바이러스 감염이나 암에서 지속적인 항원 자극으로 T세포 반응이 점진적으로 소실되며 PD-1·CTLA-4 같은 저해수용체 발현이 증가하는 현상을 무엇이라 하는가? (예: T세포 ○○)',
        options: [],
        answer: 'T세포 고갈',
      },
    ],
  },

  {
    set: {
      id: 'set-immuno-w10',
      title: '면역학 10주차 - B림프구 활성화와 항체 생산',
      description:
        '체액면역 4단계, T의존/T비의존, 1·2차 반응, BCR 신호전달(XLA), 보조수용체(CD21), 연결인식·결합백신, 배중심(암구역/명구역), 클래스전환(AID), 친화력 성숙(SHM), 형질세포·기억B세포 등 핵심 20문제.',
      tags: ['면역학', '10주차', 'B세포', '항체', '배중심'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: 'naive(숫) B림프구가 항원수용체(BCR)로 발현하는 두 종류의 막 항체는?',
        options: ['막 IgM과 IgD', 'IgG와 IgA', 'IgE와 IgM', 'IgA와 IgD'],
        answer: '막 IgM과 IgD',
      },
      {
        type: 'CHOICE',
        question_text: '클래스(동형) 전환의 핵심 원리로 옳은 것은?',
        options: [
          'V 영역(항원 특이성)은 유지되고 C 영역(작동기능)만 변경된다',
          'V 영역이 바뀌어 항원 특이성이 변경된다',
          'IgG에서 IgM으로 되돌아갈 수 있다',
          'T세포 도움 없이도 완전히 일어난다',
        ],
        answer: 'V 영역(항원 특이성)은 유지되고 C 영역(작동기능)만 변경된다',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 T의존(TD) 항체 반응의 특징이 아닌 것은?',
        options: [
          '친화력 성숙이 일어나지 않는다',
          '단백질 항원에 대한 반응이다',
          'IgG·IgA·IgE로의 클래스 전환이 일어난다',
          '장수형질세포와 기억 B세포가 생성된다',
        ],
        answer: '친화력 성숙이 일어나지 않는다',
      },
      {
        type: 'CHOICE',
        question_text: 'T비의존(TI) 항원과 그 반응의 특징으로 옳은 것은?',
        options: [
          '다당류·지질이며 주로 IgM을 생산하고 가장자리구역 B세포·B-1세포가 주도한다',
          '단백질 항원이며 클래스 전환이 활발하다',
          '배중심 반응과 친화력 성숙이 강하게 일어난다',
          '기억 B세포가 풍부하게 생성된다',
        ],
        answer: '다당류·지질이며 주로 IgM을 생산하고 가장자리구역 B세포·B-1세포가 주도한다',
      },
      {
        type: 'CHOICE',
        question_text: '2차 항체 반응의 특징으로 옳은 것은?',
        options: [
          '지체 기간이 짧고(1~3일) IgG가 우세하며 장수형질세포·기억 B세포가 많이 생긴다',
          '주로 IgM이 생산되고 친화력이 더 낮다',
          '1차 반응보다 반응 최고점이 작다',
          '단명형질세포만 생성된다',
        ],
        answer: '지체 기간이 짧고(1~3일) IgG가 우세하며 장수형질세포·기억 B세포가 많이 생긴다',
      },
      {
        type: 'CHOICE',
        question_text: 'BCR 복합체에서 ITAM을 가지고 실제 신호전달을 담당하는 단위는?',
        options: ['Igα / Igβ', '막 IgM/IgD', 'CD21', 'CD40'],
        answer: 'Igα / Igβ',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포 신호전달에서 인산화된 ITAM에 모집·활성화되는 SYK는 T세포의 무엇에 해당하는가?',
        options: ['ZAP-70', 'CD3', 'LAT', 'NFAT'],
        answer: 'ZAP-70',
      },
      {
        type: 'CHOICE',
        question_text: 'BTK 유전자 돌연변이로 B세포 발달이 차단되어 항체를 생산하지 못하는 질환은?',
        options: ['X연관 무감마글로불린혈증(XLA)', 'X연관 고IgM증후군', 'IPEX', 'APS-1'],
        answer: 'X연관 무감마글로불린혈증(XLA)',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포 보조수용체 복합체(CD21/CD19/CD81)에서 CD21(CR2)이 결합하는, 미생물에 부착된 보체 분해산물은?',
        options: ['C3d', 'C5a', 'C1q', 'MBL'],
        answer: 'C3d',
      },
      {
        type: 'OX',
        question_text:
          '보조수용체 복합체가 관여하면 BCR 신호가 약 1000배까지 증폭되어, 매우 낮은 농도의 항원에도 B세포가 반응할 수 있다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포가 BCR로 포획·내재화한 단백질 항원을 펩티드로 처리하여 보조 T세포에 제시할 때 사용하는 분자는?',
        options: ['MHC class II', 'MHC class I', 'CD21', 'FcγRIIB'],
        answer: 'MHC class II',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포가 인식하는 에피토프와 T세포가 인식하는 에피토프가 같은 항원 분자 내에 있어야 한다는 원리로, 결합백신 설계의 기초가 되는 것은?',
        options: ['연결 인식(Linked recognition)', '교차 반응', '클론 선택', '친화력 성숙'],
        answer: '연결 인식(Linked recognition)',
      },
      {
        type: 'CHOICE',
        question_text: '활성화된 림프구가 소포(배중심) 방향으로 이동하기 위해 발현이 증가하는 케모카인 수용체는?',
        options: ['CXCR5', 'CCR7', 'CD40', 'CD25'],
        answer: 'CXCR5',
      },
      {
        type: 'CHOICE',
        question_text: '보조 T세포의 CD40L가 결합하는 B세포 표면 수용체로, 이 접촉 신호가 클래스 전환에 필수적인 것은?',
        options: ['CD40', 'CD28', 'PD-1', 'CTLA-4'],
        answer: 'CD40',
      },
      {
        type: 'CHOICE',
        question_text: '사이토카인에 의한 클래스 전환 방향을 옳게 짝지은 것은?',
        options: ['IL-4 → IgE', 'IFN-γ → IgA', 'TGF-β → IgE', 'IL-4 → IgG'],
        answer: 'IL-4 → IgE',
      },
      {
        type: 'CHOICE',
        question_text: '클래스 전환 재조합(CSR)과 체세포 과돌연변이(SHM)에 모두 필수적이며, 시티딘을 우라실로 바꾸는(cytidine deaminase) 효소는?',
        options: ['AID', 'RAG', 'SYK', 'BTK'],
        answer: 'AID',
      },
      {
        type: 'CHOICE',
        question_text: 'CD40L 유전자 돌연변이로 클래스 전환이 불가능해 IgM만 생산되고 IgG/IgA/IgE가 없는 질환은?',
        options: ['X연관 고IgM증후군', 'XLA', 'IPEX', 'APS-1'],
        answer: 'X연관 고IgM증후군',
      },
      {
        type: 'CHOICE',
        question_text: '배중심의 암구역(dark zone)에서 주로 일어나는 과정은?',
        options: [
          '빠른 B세포 증식과 체세포 과돌연변이(SHM)',
          'FDC 항원과의 경쟁적 결합을 통한 고친화력 세포 선택',
          'Tfh의 생존 신호 제공',
          '저친화력 B세포의 아포토시스',
        ],
        answer: '빠른 B세포 증식과 체세포 과돌연변이(SHM)',
      },
      {
        type: 'CHOICE',
        question_text: '골수로 이동하여 수년간 항체를 지속 생산하며 세포 분열·BCR 발현이 없는 세포는?',
        options: ['장수형질세포', '형질모세포', '기억 B세포', 'naive B세포'],
        answer: '장수형질세포',
      },
      {
        type: 'SHORT',
        question_text:
          '다당류 항원을 단백질 운반체에 화학적으로 결합하여 T의존 반응으로 전환시킴으로써 영아에서도 IgG·기억세포 형성을 유도하는 백신의 종류를 쓰시오. (Hib·폐렴알균 백신 등)',
        options: [],
        answer: '결합백신',
      },
    ],
  },

  {
    set: {
      id: 'set-immuno-w11',
      title: '면역학 11주차 - 체액면역의 작동기작',
      description:
        '항체 동형별 기능, 중화·옵소닌화, FcRn, Fc수용체·ADCC, 보체 3경로(고전/대체/렉틴)·MAC·조절, IgA 점막면역, 신생아 면역, 면역회피, 예방접종 전략 등 핵심 20문제.',
      tags: ['면역학', '11주차', '보체', '항체', 'ADCC'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '항체가 미생물 또는 독소에 결합하여 숙주세포 수용체와의 결합을 차단하는 작동기능은?',
        options: ['중화(Neutralization)', '옵소닌화', '보체 활성화', 'ADCC'],
        answer: '중화(Neutralization)',
      },
      {
        type: 'CHOICE',
        question_text: '혈청에서 가장 풍부하며 옵소닌화·ADCC를 담당하고 FcRn을 통해 태반을 통과하는 동형은?',
        options: ['IgG', 'IgM', 'IgA', 'IgE'],
        answer: 'IgG',
      },
      {
        type: 'CHOICE',
        question_text: '5량체 구조로 보체 고전경로를 매우 효율적으로 활성화하며 1차 반응 초기에 주로 생산되는 동형은?',
        options: ['IgM', 'IgG', 'IgA', 'IgD'],
        answer: 'IgM',
      },
      {
        type: 'CHOICE',
        question_text: '점막 분비물에 풍부하며 분비형(이량체)으로 점막 표면의 미생물을 중화하는 동형은?',
        options: ['IgA', 'IgG', 'IgM', 'IgE'],
        answer: 'IgA',
      },
      {
        type: 'CHOICE',
        question_text: 'FcRn(신생아 Fc수용체)의 두 가지 핵심 기능으로 옳은 것은?',
        options: [
          'IgG 혈청 반감기 연장과 모체 IgG의 태반 전달',
          'IgM의 보체 활성화와 응집',
          'IgA의 점막 운반과 분비',
          'IgE의 비만세포 결합과 탈과립',
        ],
        answer: 'IgG 혈청 반감기 연장과 모체 IgG의 태반 전달',
      },
      {
        type: 'CHOICE',
        question_text: '옵소닌화에서 IgG가 결합하는 큰포식세포·호중구의 고친화력 Fc수용체는?',
        options: ['FcγRI(CD64)', 'FcγRIIB(CD32)', 'FcγRIIIA(CD16)', 'FcεRI'],
        answer: 'FcγRI(CD64)',
      },
      {
        type: 'CHOICE',
        question_text: 'Fc수용체 중 유일한 억제성 수용체로 ITIM을 가지며 항체 되먹임 조절의 핵심인 것은?',
        options: ['FcγRIIB(CD32)', 'FcγRI(CD64)', 'FcγRIIIA(CD16)', 'FcεRI'],
        answer: 'FcγRIIB(CD32)',
      },
      {
        type: 'CHOICE',
        question_text: 'ADCC에서 NK세포가 IgG로 코팅된 표적세포를 인식하는 수용체는? (살해는 perforin/granzyme)',
        options: ['FcγRIIIA(CD16)', 'FcγRI(CD64)', 'FcγRIIB(CD32)', 'FcεRI'],
        answer: 'FcγRIIIA(CD16)',
      },
      {
        type: 'CHOICE',
        question_text: '항원-항체 복합체에 C1q가 결합하여 시작되는 적응면역 보체 경로는?',
        options: ['고전경로', '대체경로', '렉틴경로', '응고경로'],
        answer: '고전경로',
      },
      {
        type: 'CHOICE',
        question_text: '항체 없이 미생물 표면에서 C3의 자발적 가수분해(tick-over)로 시작되는 선천면역 보체 경로는?',
        options: ['대체경로', '고전경로', '렉틴경로', '응고경로'],
        answer: '대체경로',
      },
      {
        type: 'CHOICE',
        question_text: '만노스결합렉틴(MBL)이 미생물 표면의 만노스 잔기를 인식하여 항체 없이 보체를 활성화하는 경로는?',
        options: ['렉틴경로', '고전경로', '대체경로', '응고경로'],
        answer: '렉틴경로',
      },
      {
        type: 'CHOICE',
        question_text: '고전경로에서 C1q가 단 1개의 분자로도 결합을 시작할 수 있는 동형과 그 이유로 옳은 것은?',
        options: [
          'IgM — 5량체라 항원 결합 후 C1q 결합 부위가 충분히 노출되기 때문',
          'IgG — 단량체라 결합이 쉽기 때문',
          'IgA — 분비형 이량체이기 때문',
          'IgE — 비만세포에 결합하기 때문',
        ],
        answer: 'IgM — 5량체라 항원 결합 후 C1q 결합 부위가 충분히 노출되기 때문',
      },
      {
        type: 'CHOICE',
        question_text: '막공격복합체(MAC, C5b-9)가 주로 효과적인 균과 그 임상적 의의로 옳은 것은?',
        options: [
          '세포벽이 얇은 나이세리아에 효과적이며, C5~C9 결핍 시 나이세리아 반복 감염',
          '협막을 가진 폐렴구균에 가장 효과적',
          '아포 형성균에만 작용',
          '바이러스 감염 세포를 직접 용해',
        ],
        answer: '세포벽이 얇은 나이세리아에 효과적이며, C5~C9 결핍 시 나이세리아 반복 감염',
      },
      {
        type: 'CHOICE',
        question_text: '보체 분해산물 중 호중구 화학주성과 혈관 투과성 증가 등 강력한 염증 매개 작용을 하는 것은?',
        options: ['C3a, C5a', 'C3b, C4b', 'C1q', 'MBL'],
        answer: 'C3a, C5a',
      },
      {
        type: 'CHOICE',
        question_text: 'C3b가 미생물 표면에 결합하여 포식세포의 CR1이 인식하게 함으로써 포식작용을 촉진하는 보체 기능은?',
        options: ['옵소닌화', '세포 용해', '염증 유도', '중화'],
        answer: '옵소닌화',
      },
      {
        type: 'OX',
        question_text:
          '발작성 야간혈색소뇨(PNH)는 보체 조절 단백질(DAF, CD59 등) 결핍으로 적혈구 표면에서 보체 활성화 조절이 안 되어 용혈이 일어나는 질환이다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '이량체 IgA가 상피세포를 가로질러 내강으로 운반될 때 사용하는 수용체는? (분비성 성분 SC가 항체를 보호)',
        options: ['poly-Ig 수용체(pIgR)', 'FcRn', 'FcγRI', 'CR1'],
        answer: 'poly-Ig 수용체(pIgR)',
      },
      {
        type: 'CHOICE',
        question_text: '신생아가 생후 3~6개월에 감염에 가장 취약한 이유로 옳은 것은?',
        options: [
          '모체 IgG가 소진되고 신생아 자체 IgG 생산이 아직 충분하지 않은 시기이기 때문',
          '초유의 IgA가 과도하게 작용하기 때문',
          '태반을 통해 IgM이 대량 전달되기 때문',
          '보체가 완전히 결핍되어 있기 때문',
        ],
        answer: '모체 IgG가 소진되고 신생아 자체 IgG 생산이 아직 충분하지 않은 시기이기 때문',
      },
      {
        type: 'CHOICE',
        question_text: '인플루엔자가 매년 새로운 변이주를 출현시켜 기존 항체를 회피하는 면역회피 기전은?',
        options: [
          '항원성 변이(소변이·대변이)',
          'Factor H 결합을 통한 보체 억제',
          '히알루론산 협막에 의한 포식 차단',
          'IL-10 생산',
        ],
        answer: '항원성 변이(소변이·대변이)',
      },
      {
        type: 'SHORT',
        question_text:
          '디프테리아·파상풍 백신처럼 독소를 무독화하고 항원성만 남겨 중화항체를 유도하는, 변형 단백질 백신 성분의 이름을 쓰시오.',
        options: [],
        answer: '톡소이드',
      },
    ],
  },

  {
    set: {
      id: 'set-immuno-w12',
      title: '면역학 12주차 - 면역관용과 자가면역',
      description:
        '중추/말초관용, AIRE·APS-1, Treg(FOXP3·IPEX)와 억제 기작, anergy·exhaustion·AICD(ALPS), B세포 관용, 공생·태아 관용, 자가면역(MHC·분자모방·SLE·류마티스열) 등 핵심 20문제.',
      tags: ['면역학', '12주차', '면역관용', '자가면역', 'Treg'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '특정 항원에 대해 면역계가 반응하지 않는 상태로, 자기항원에 대한 것이 자가면역질환 예방에 필수인 것은?',
        options: ['면역관용', '면역기억', '면역증강', '클론 선택'],
        answer: '면역관용',
      },
      {
        type: 'CHOICE',
        question_text: '가슴샘 피질의 양성선별에서 MHC 인식에 따른 분화로 옳은 것은?',
        options: [
          'MHC-I 인식 → CD8+ T세포, MHC-II 인식 → CD4+ T세포',
          'MHC-I 인식 → CD4+ T세포, MHC-II 인식 → CD8+ T세포',
          '두 경우 모두 CD4+ T세포로 분화',
          '두 경우 모두 제거된다',
        ],
        answer: 'MHC-I 인식 → CD8+ T세포, MHC-II 인식 → CD4+ T세포',
      },
      {
        type: 'CHOICE',
        question_text: '가슴샘 수질에서 자기항원에 강하게 결합하는 T세포가 세포자멸사로 제거되는 과정은?',
        options: ['음성선별(클론제거)', '양성선별', '수용체 편집', '클론 선택'],
        answer: '음성선별(클론제거)',
      },
      {
        type: 'CHOICE',
        question_text: 'mTEC에서 인슐린 등 조직제한항원을 발현시켜 자기반응성 T세포를 제거하며, 결핍 시 APS-1을 일으키는 전사인자는?',
        options: ['AIRE', 'FOXP3', 'T-bet', 'RORγt'],
        answer: 'AIRE',
      },
      {
        type: 'CHOICE',
        question_text: '조절T세포(Treg)의 계통을 결정하는 핵심 전사인자로, 돌연변이 시 IPEX를 일으키는 것은?',
        options: ['FOXP3', 'AIRE', 'T-bet', 'GATA-3'],
        answer: 'FOXP3',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 조절T세포(Treg)의 억제 기작이 아닌 것은?',
        options: [
          '항원 비특이적 보체 활성화',
          '억제성 사이토카인(IL-10, TGF-β, IL-35) 분비',
          'CTLA-4로 APC의 B7 차단',
          '고친화력 IL-2 수용체(CD25)로 IL-2 경쟁',
        ],
        answer: '항원 비특이적 보체 활성화',
      },
      {
        type: 'CHOICE',
        question_text: 'T세포에 신호1(TCR-MHC)만 있고 공동자극(신호2)이 없을 때 일어나는 기능적 불활성화 상태는?',
        options: ['무반응(Anergy)', '소진(Exhaustion)', '클론제거', '양성선별'],
        answer: '무반응(Anergy)',
      },
      {
        type: 'CHOICE',
        question_text: '만성 감염·종양에서 지속적 항원 자극으로 T세포 기능이 점진적으로 소실되며 PD-1·LAG-3·TIM-3 발현이 증가하는 상태는?',
        options: ['소진(Exhaustion)', '무반응(Anergy)', '클론제거', '친화력 성숙'],
        answer: '소진(Exhaustion)',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포 중추관용의 주요 기작으로, 자기항원에 결합하는 미성숙 B세포가 RAG를 재활성화해 경사슬 유전자를 재배열하는 것은?',
        options: ['수용체 편집(Receptor editing)', '클론제거', '무반응', '친화력 성숙'],
        answer: '수용체 편집(Receptor editing)',
      },
      {
        type: 'OX',
        question_text: 'T세포는 중추관용이, B세포는 말초관용이 상대적으로 더 주된 관용 기작이다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: 'FAS 또는 FasL 유전자 돌연변이로 림프구 세포자멸사(AICD)가 결손되어 림프절 비대·자가면역을 일으키는 질환은?',
        options: ['ALPS(자가면역 림프증식 증후군)', 'IPEX', 'APS-1', 'XLA'],
        answer: 'ALPS(자가면역 림프증식 증후군)',
      },
      {
        type: 'CHOICE',
        question_text: 'FOXP3 유전자 돌연변이로 Treg 발달이 결손되어 전신 자가면역을 일으키는 X연관 질환은?',
        options: ['IPEX', 'APS-1', 'ALPS', 'SLE'],
        answer: 'IPEX',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 임신 중 모체-태아 관용 기작에 해당하지 않는 것은?',
        options: [
          '보체 막공격복합체(MAC) 활성화 증가',
          '자궁 내 FOXP3+ 조절T세포 증가',
          'IDO 효소에 의한 트립토판 분해',
          '영양막세포의 HLA-G 발현',
        ],
        answer: '보체 막공격복합체(MAC) 활성화 증가',
      },
      {
        type: 'CHOICE',
        question_text: '자가면역 발병의 유전적 위험인자 중 가장 강력한 것은?',
        options: ['MHC(HLA) 유전자', 'PTPN22', 'CTLA4', 'IL23R'],
        answer: 'MHC(HLA) 유전자',
      },
      {
        type: 'CHOICE',
        question_text: 'A군 사슬알균 항원이 심장 근육 단백질(미오신)과 구조적으로 유사해 교차반응을 일으키는, 감염이 자가면역을 유발하는 기전은?',
        options: ['분자모방(Molecular mimicry)', '격리 항원 방출', 'APC 활성화', 'IFN-α 과다 생산'],
        answer: '분자모방(Molecular mimicry)',
      },
      {
        type: 'CHOICE',
        question_text: '분자모방 기전으로 인후염 후 2~4주에 발생하며 심장 판막을 손상시키는 자가면역질환은?',
        options: ['류마티스열', '전신홍반루푸스', '제1형 당뇨병', '그레이브스병'],
        answer: '류마티스열',
      },
      {
        type: 'CHOICE',
        question_text: '항핵항체(ANA)·항dsDNA, 나비 모양 안면 발진, 자외선 노출 시 악화, 여성에서 약 9:1로 흔한 전신 자가면역질환은?',
        options: ['전신홍반루푸스(SLE)', '류마티스관절염', '강직성척추염', '다발성경화증'],
        answer: '전신홍반루푸스(SLE)',
      },
      {
        type: 'OX',
        question_text:
          '자외선(UV)은 피부 세포 사멸로 핵 항원(DNA·히스톤)을 노출시켜 SLE를 악화시키므로, SLE 환자에게 햇빛 차단이 중요한 관리 방법이다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '감염이 무반응 상태의 자기반응성 T세포를 활성화시킬 수 있는 기전(APC 활성화)으로 옳은 것은?',
        options: [
          '미생물 PAMP가 TLR을 자극 → APC가 공동자극분자(B7) 발현 → 공동자극 제공',
          '미생물이 격리 항원을 방출',
          '에스트로겐이 B세포를 활성화',
          'Treg가 IL-2를 소비',
        ],
        answer: '미생물 PAMP가 TLR을 자극 → APC가 공동자극분자(B7) 발현 → 공동자극 제공',
      },
      {
        type: 'SHORT',
        question_text:
          '자기항원에 중간 친화력으로 결합하는 CD4+ T세포가 분화하며 CD25·FOXP3를 발현하고 CTLA-4를 높게 발현해 말초에서 자기반응성을 억제하는 세포를 무엇이라 하는가? (한글 명칭)',
        options: [],
        answer: '조절T세포',
      },
    ],
  },

  {
    set: {
      id: 'set-immuno-w13',
      title: '면역학 13주차 - 종양과 이식에 대한 면역',
      description:
        '면역감시, 종양항원, 종양거부·회피, 면역치료(단클론항체·CAR-T·면역관문억제제), 종양백신, 이식항원·동종인식, 거부 3종류, 면역억제제, GVHD/GVL 등 핵심 20문제.',
      tags: ['면역학', '13주차', '종양면역', '이식', '면역치료'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '암과 이식은 모두 "자기와 유전적으로 다른 세포"에 대한 반응이나, 치료 목표의 차이로 옳은 것은?',
        options: [
          '암에서는 면역 증강, 이식에서는 면역 억제가 목표이다',
          '암에서는 면역 억제, 이식에서는 면역 증강이 목표이다',
          '둘 다 면역 증강이 목표이다',
          '둘 다 면역 억제가 목표이다',
        ],
        answer: '암에서는 면역 증강, 이식에서는 면역 억제가 목표이다',
      },
      {
        type: 'CHOICE',
        question_text: '정상세포에 없어 면역관용을 유도하지 않으므로 적응면역의 가장 일반적인 표적이 되는 종양항원은?',
        options: ['신생항원(Neoantigen)', '암/고환 항원', '과발현 정상 단백질', '조직특이 단백질'],
        answer: '신생항원(Neoantigen)',
      },
      {
        type: 'CHOICE',
        question_text: '유전자 증폭으로 과발현되며 표적 항암제 허셉틴(트라스투주맙)의 표적이 되는 유방암 종양항원은?',
        options: ['HER2', 'CEA', 'CD20', 'EGFR'],
        answer: 'HER2',
      },
      {
        type: 'CHOICE',
        question_text: '종양 근절의 주요 면역 기작은?',
        options: [
          '종양항원 특이 CD8+ CTL에 의한 종양세포 살해',
          'B세포 항체에 의한 중화',
          '호산구의 탈과립',
          'Treg에 의한 억제',
        ],
        answer: '종양항원 특이 CD8+ CTL에 의한 종양세포 살해',
      },
      {
        type: 'CHOICE',
        question_text: '수지상세포가 섭취한 종양항원을 1형 MHC에 제시하여 naive CD8+ T세포를 활성화하는 과정은?',
        options: ['교차제시(cross-presentation)', '직접 동종인식', '옵소닌화', '클래스 전환'],
        answer: '교차제시(cross-presentation)',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 종양의 면역 회피 기작이 아닌 것은?',
        options: [
          'MHC class II 과발현으로 CD8 T세포 활성화 증가',
          '1형 MHC 결핍(β2-microglobulin 돌연변이 등)',
          '항원 소실 변이체 선택',
          'PD-L1 발현 및 면역억제 사이토카인(TGF-β, IL-10) 분비',
        ],
        answer: 'MHC class II 과발현으로 CD8 T세포 활성화 증가',
      },
      {
        type: 'CHOICE',
        question_text: '많은 종양세포가 발현하여 T세포의 PD-1과 결합함으로써 T세포 활성화를 억제하고 면역 감시를 회피하게 하는 리간드는?',
        options: ['PD-L1', 'B7', 'CD40L', 'HER2'],
        answer: 'PD-L1',
      },
      {
        type: 'CHOICE',
        question_text: 'B세포 림프종에서 CD20을 표적으로 하는 단클론항체 항암제는?',
        options: ['Rituximab(맙테라)', 'Trastuzumab(허셉틴)', 'Cetuximab(얼비툭스)', 'Ipilimumab'],
        answer: 'Rituximab(맙테라)',
      },
      {
        type: 'CHOICE',
        question_text: 'CAR-T 세포 치료의 핵심 장점은?',
        options: [
          'MHC 비의존적으로 종양항원을 직접 인식하여 MHC 발현 소실 종양에도 효과적',
          '항체를 대량 분비하여 보체를 활성화',
          'NK세포를 동원하여 ADCC를 유도',
          'Treg를 증식시켜 염증을 억제',
        ],
        answer: 'MHC 비의존적으로 종양항원을 직접 인식하여 MHC 발현 소실 종양에도 효과적',
      },
      {
        type: 'CHOICE',
        question_text: 'CAR-T 세포 치료의 대표적인 부작용은?',
        options: ['사이토카인 폭풍', '초급성 거부', '아나필락시스', '저감마글로불린혈증'],
        answer: '사이토카인 폭풍',
      },
      {
        type: 'CHOICE',
        question_text: '항-CTLA-4 항체(ipilimumab)의 항종양 작용 기전은?',
        options: [
          'CTLA-4가 B7에 결합하는 것을 차단 → B7-CD28 공동자극 회복 → T세포 활성화',
          'PD-1과 PD-L1의 결합을 차단 → 소진 역전',
          'HER2 신호를 차단 → 종양 증식 억제',
          '보체를 활성화하여 종양세포 용해',
        ],
        answer: 'CTLA-4가 B7에 결합하는 것을 차단 → B7-CD28 공동자극 회복 → T세포 활성화',
      },
      {
        type: 'CHOICE',
        question_text: '항-CTLA-4와 항-PD-1/PD-L1의 작용 단계 차이로 옳은 것은?',
        options: [
          'CTLA-4 차단은 림프절의 T세포 초기 활성화 단계에, PD-1 차단은 말초(종양)에서 활성화된 T세포의 소진 역전에 작용',
          '둘 다 림프절 초기 활성화 단계에만 작용',
          'CTLA-4 차단은 말초에서, PD-1 차단은 림프절에서 작용',
          '둘 다 B세포 항체 생산을 차단',
        ],
        answer: 'CTLA-4 차단은 림프절의 T세포 초기 활성화 단계에, PD-1 차단은 말초(종양)에서 활성화된 T세포의 소진 역전에 작용',
      },
      {
        type: 'CHOICE',
        question_text: 'HPV 예방접종이 자궁경부암을 예방하는 원리는?',
        options: [
          'HPV의 E6·E7 단백질이 종양항원으로 작용하여, 바이러스 예방접종이 곧 암 예방이 되기 때문',
          'HPV가 PD-L1을 억제하기 때문',
          'HPV 백신이 Treg를 제거하기 때문',
          'HPV 백신이 CAR-T를 유도하기 때문',
        ],
        answer: 'HPV의 E6·E7 단백질이 종양항원으로 작용하여, 바이러스 예방접종이 곧 암 예방이 되기 때문',
      },
      {
        type: 'CHOICE',
        question_text: '동종이식(allograft) 거부에서 가장 중요한 동종항원의 원천은?',
        options: ['MHC(HLA) 다형성', 'ABO 혈액형 항원', '비MHC 부 조직적합항원', '미토콘드리아 항원'],
        answer: 'MHC(HLA) 다형성',
      },
      {
        type: 'CHOICE',
        question_text: '수여자에게 이미 존재하던 항체(혈액형·항-HLA)가 이식편 혈관내피와 즉각 반응하여 수분~수시간 내에 발생하는 거부는?',
        options: ['초급성 거부', '급성 거부', '만성 거부', '이식편대숙주병'],
        answer: '초급성 거부',
      },
      {
        type: 'CHOICE',
        question_text: '직접 동종인식과 간접 동종인식의 비교로 옳은 것은?',
        options: [
          '직접: 공여자 DC가 동종 MHC를 직접 제시 → CD8 T세포(급성 거부) / 간접: 수여자 DC가 처리해 수여자 MHC로 제시 → CD4 T세포(만성 거부)',
          '직접: 수여자 DC가 처리 → CD4 / 간접: 공여자 DC가 직접 제시 → CD8',
          '둘 다 공여자 DC가 항원을 제시한다',
          '둘 다 CD8 T세포만 활성화한다',
        ],
        answer: '직접: 공여자 DC가 동종 MHC를 직접 제시 → CD8 T세포(급성 거부) / 간접: 수여자 DC가 처리해 수여자 MHC로 제시 → CD4 T세포(만성 거부)',
      },
      {
        type: 'CHOICE',
        question_text: '칼시뉴린 억제제(cyclosporine, tacrolimus)의 작용 기전은?',
        options: [
          'NFAT 전사인자의 핵 이동을 차단 → IL-2 등 사이토카인 생성 억제',
          'IMPDH를 억제 → 림프구 DNA 합성 차단',
          'mTOR 경로를 억제 → IL-2 신호 하류 차단',
          'B7에 결합 → CD28 공동자극 차단',
        ],
        answer: 'NFAT 전사인자의 핵 이동을 차단 → IL-2 등 사이토카인 생성 억제',
      },
      {
        type: 'CHOICE',
        question_text: '조혈줄기세포 이식(HSCT)에서 골수 내 공여자 T세포가 수여자의 정상 조직을 외래로 인식해 공격하는 합병증은?',
        options: ['이식편대숙주병(GVHD)', '초급성 거부', '만성 거부', '발작성 야간혈색소뇨'],
        answer: '이식편대숙주병(GVHD)',
      },
      {
        type: 'OX',
        question_text:
          'GVHD를 완전히 억제하면 공여자 T세포가 잔류 백혈병세포를 제거하는 이식편대백혈병(GVL) 효과도 소실되어 백혈병 재발 위험이 증가한다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'SHORT',
        question_text:
          '동종이식 거부의 주요 원인이 되는, 공여자와 수여자 사이에 차이를 보이는 항원을 통칭하여 무엇이라 하는가? (한글 명칭)',
        options: [],
        answer: '동종항원',
      },
    ],
  },
]

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return

    const envFile = fs.readFileSync(envPath, 'utf8')
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (!match) continue

      const key = match[1].trim()
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    console.warn('Warning: Could not load .env.local manually.')
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  for (const { set, questions } of sets) {
    if (questions.length !== 20) {
      throw new Error(`${set.id} has ${questions.length} questions (expected 20)`)
    }

    console.log(`Seeding ${set.title}: ${set.id} (${questions.length} questions)`)

    const { error: setError } = await supabase
      .from('question_sets')
      .upsert(set, { onConflict: 'id' })

    if (setError) throw setError

    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('set_id', set.id)

    if (deleteError) throw deleteError

    const { error: questionError } = await supabase.from('questions').insert(
      questions.map((question) => ({ set_id: set.id, ...question }))
    )

    if (questionError) throw questionError

    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', set.id)

    if (countError) throw countError

    console.log(`  → inserted ${count ?? 0} questions`)
  }

  console.log('Seed complete.')
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
