import svgPaths from "./svg-aregenf71c";

function Group1() {
  return (
    <div className="absolute h-[200px] left-[33px] top-[240px] w-[346px]">
      <div className="absolute bottom-0 left-0 right-0 top-[-0.07%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 346 201">
          <g id="Group 2">
            <path d={svgPaths.p237e0200} fill="var(--fill-0, #D9D9D9)" id="Star 1" />
            <path d={svgPaths.p3e38700} fill="url(#paint0_linear_1_57)" id="Vector 1" stroke="var(--stroke-0, #1E1E1E)" />
          </g>
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_1_57" x1="223.5" x2="126.5" y1="0.141574" y2="98.1416">
              <stop stopColor="#24B2FB" />
              <stop offset="0.943097" stopColor="#156A95" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute h-[196px] left-[63px] top-[402px] w-[302px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 302 196">
        <g id="Group 1">
          <path d={svgPaths.p1006d580} fill="var(--fill-0, #D9D9D9)" id="Star 2" />
          <path d={svgPaths.p2f720000} fill="url(#paint0_linear_1_53)" id="Vector 2" stroke="var(--stroke-0, #1E1E1E)" />
        </g>
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_1_53" x1="101" x2="198" y1="180.5" y2="82.5">
            <stop stopColor="#24B2FB" />
            <stop offset="0.943097" stopColor="#156A95" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Iphone() {
  return (
    <div className="bg-white relative size-full" data-name="Iphone 14 - 5">
      <div className="absolute bg-[rgba(244,101,230,0.78)] h-[267px] left-[145px] rounded-[34px] top-[289px] w-[137px]" />
      <Group1 />
      <Group />
    </div>
  );
}