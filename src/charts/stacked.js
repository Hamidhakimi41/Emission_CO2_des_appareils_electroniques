const svg = d3.select("#stacked");
const width = +svg.attr("width");
const height = +svg.attr("height");

const margin = { top: 50, right: 30, bottom: 80, left: 70 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Phases du cycle de vie
const keys = ["manufacturing", "use", "transport", "eol"];

// Couleurs
const color = d3.scaleOrdinal()
    .domain(keys)
    .range(["#2E7D32", "#66BB6A", "#AED581", "#C8E6C9"]);

d3.csv("boavizta_data_cleaned.csv", d => ({
    subcategory: d.subcategory,
    manufacturing: +d.gwp_manufacturing_kg,
    use: +d.gwp_use_kg,
    transport: +d.gwp_gwp_total * +d.gwp_transport_ratio,
    eol: +d.gwp_total * +d.gwp_eol_ratio
})).then(data => {

    // --- AGRÉGATION PAR SUBCATEGORY ---
    const aggregated = d3.rollups(
        data,
        v => ({
            manufacturing: d3.mean(v, d => d.manufacturing),
            use: d3.mean(v, d => d.use),
            transport: d3.mean(v, d => d.transport),
            eol: d3.mean(v, d => d.eol)
        }),
        d => d.subcategory
    ).map(([subcategory, values]) => ({
        subcategory,
        ...values
    }));

    // --- STACK ---
    const stack = d3.stack().keys(keys);
    const stackedData = stack(aggregated);

    // --- SCALES ---
    const x = d3.scaleBand()
        .domain(aggregated.map(d => d.subcategory))
        .range([0, innerWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(aggregated, d =>
            d.manufacturing + d.use + d.transport + d.eol
        )])
        .nice()
        .range([innerHeight, 0]);

    // --- AXES ---
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");

    g.append("g")
        .call(d3.axisLeft(y));

    // --- BARS ---
    g.selectAll(".layer")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.subcategory))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth());

    // --- TITRE ---
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Répartition de l’empreinte carbone par cycle de vie");

    // --- LÉGENDE ---
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 180},${margin.top})`);

    keys.forEach((key, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`);

        row.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(key));

        row.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .text(key);
    });
});
