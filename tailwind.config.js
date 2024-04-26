/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "content/blog/**/*.md",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ff3e00', // Custom primary color
      },
    },
  },
  plugins: [
    `gatsby-plugin-postcss`,
  ],
}

