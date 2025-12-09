console.log("stacked loaded");

// on change svg → stackedSvg
const stackedSvg = d3.select("#stacked");
const width = +stackedSvg.attr("width");
const height = +stackedSvg.attr("height");

const margin = { top: 40, right: 20, bottom: 60, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const g = stackedSvg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

d3.csv("data/stacked_data.csv").then(data => {

    const keys = ["gwp_manufacturing", "gwp_use", "gwp_transport", "gwp_eol"];

    data.forEach(d => {
        keys.forEach(k => d[k] = +d[k]);
    });

    const stack = d3.stack().keys(keys);
    const stackedData = stack(data);

    const x = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(data, d => keys.reduce((sum, k) => sum + d[k], 0))
        ])
        .range([innerHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#4daf4a", "#377eb8", "#ff7f00", "#984ea3"]);

    g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    g.selectAll("g.layer")
        .data(stackedData)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => x(d.data.name))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth());
});
