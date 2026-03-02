import {
    Chart as ChartJS,
    LinearScale,
    CategoryScale,
    BarElement,
    PointElement,
    LineElement,
    Legend,
    Tooltip,
    LineController,
    BarController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { GetTransactionDataRes } from '../lib/backend-clients';

ChartJS.register(
    LinearScale,
    CategoryScale,
    BarElement,
    PointElement,
    LineElement,
    Legend,
    Tooltip,
    LineController,
    BarController
);

interface AccountCardChartProps {
    chartData: GetTransactionDataRes["chartData"];
}

const getDaisyColors = (prop: string = '--color-primary') => {
    const doc = document.querySelector(':root')
    if (doc) {
        return getComputedStyle(doc).getPropertyValue(prop)
    }
}

export const AccountCardChart = ({ chartData }: AccountCardChartProps) => {
    const maxView = 6
    return (
        <div className='w-1/2'>
            {Object.entries(chartData).map(([currency, valuesLabels]) => {
                const data = {
                    labels: valuesLabels.labels.slice(maxView * -1),
                    datasets: [
                        {
                            type: 'line' as const,
                            label: `Movement - ${currency}`,
                            borderColor: `${getDaisyColors('--color-info-content')}`,
                            data: valuesLabels.movementValues.slice(maxView * -1)
                        }, {
                            type: 'bar' as const,
                            label: `Balance - ${currency}`,
                            backgroundColor: `${getDaisyColors('--color-info')}`,
                            data: valuesLabels.balanceValues.slice(maxView * -1)
                        }

                    ]
                }
                return <Chart type='bar' data={data} />;
            })}
        </div>
    )
}