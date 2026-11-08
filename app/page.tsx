import Image from "next/image";

export default function Home() {
  return (
   <div className="flex bg-[#CEE1B6] w-full min-h-dvh p-4">

    <header className="">
      wandr
    </header>
    <div className="flex items-center justify-center gap-4 flex-1">

    <div className="px-8 py-3 rounded-4xl bg-white lowercase">
      <span>I want to wander for</span>

          <select
            id="duration"
            name="duration"
            defaultValue="15"
            className="cursor-pointer rounded-lg border-1 border-gray-300 px-2 py-2 mx-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="45">45</option>
          </select>

          <span>minutes</span>
     </div>

      <button className="px-8 py-4 bg-black rounded-4xl text-white">
        go!
      </button>


    </div>
   
    
   </div>


  );
}
