import {HttpEndpoint} from './HttpEndpoint';
import SwaggerParser from '@apidevtools/swagger-parser';
import {
    Form,
    FormGroup,
    TextInput,
    ActionGroup,
    Button,
    FileUpload,
    InputGroup,
    Checkbox,
    FormSelect,
    FormSelectOption, Grid, GridItem,
} from '@patternfly/react-core';
import {OpenAPI, OpenAPIV3, OpenAPIV2, OpenAPIV3_1} from 'openapi-types';
import {ReactElement, useEffect, useRef, useState} from 'react';

//TODO distinguish between source/sink type of extension

const timeUnits: Map<string, number> = new Map<string, number>([
    ['ms', 1],
    ['s', 1000],
    ['min', 1000 * 60],
    ['hour', 1000 * 3600],
    ['day', 1000 * 3600 * 24],
])

export interface IEndpoint {
    name: string;
    pathItem:
        | OpenAPIV2.PathItemObject
        | OpenAPIV3.PathItemObject
        | OpenAPIV3_1.PathItemObject
        | undefined;
    operations: Map<string, OpenAPI.Operation>;
}

async function parseApiSpec(input: string | OpenAPI.Document): Promise<IEndpoint[]> {
    let swaggerParser: SwaggerParser = new SwaggerParser();

    const e: Array<IEndpoint> = [];
    let api: OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;

    try {
        api = await swaggerParser.validate(input, {dereference: {circular: 'ignore'}});
        // @ts-ignore
        Object.entries(swaggerParser.api.paths).forEach((p) => e.push({name: p[0], pathItem: p[1]}));
    } catch (error) {
        console.error('error ' + error);
    }
    return e;
}

type HttpStepParams = {
    url: string,
    period: number,
    contentType: string,
}

const HttpStep = (props: any) => {
    let initPeriodINputValue = props.stepParams?.period;
    let initTimeUnit = 's';

    timeUnits.forEach((v, k) => {
        const period = props.stepParams?.period || 1;
        if (period / v >= 1 && period % v == 0) {
            initPeriodINputValue = period / v;
            initTimeUnit = k;
        }
    })


    const [openApiSpecText, setOpenApiSpecText] = useState('');
    const endpoints = useRef<IEndpoint[]>([]);
    const [currentEndpoint, setCurrentEndpoint] = useState<IEndpoint>({
        name: '',
        pathItem: {},
        operations: new Map(),
    });
    const [upload, setUpload] = useState<boolean>(false);
    const [paramString, setParamString] = useState<string>('');
    const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');

    const [stepParams, setStepParams] = useState<HttpStepParams>({
        url: props.stepParams?.url || '',
        period: props.stepParams?.period || 1,
        contentType: props.stepParams?.contentType || ''
    })
    const [basePath, setBasePath] = useState<string>('');
    const [apiSpecUrl, setApiUrl] = useState<string>('https://api.chucknorris.io/documentation');
    const [timeUnit, setTImeUnit] = useState<string>(initTimeUnit);
    const [periodInputValue, setPeriodInputValue] = useState<number>(initPeriodINputValue);

    const parseSpec = async (input: string) => {
        endpoints.current = await parseApiSpec(input);
        setCurrentEndpoint(endpoints.current[0]);
    };

    useEffect(() => {
        let apiDoc = '';
        if (upload && openApiSpecText !== '') {
            apiDoc = JSON.parse(openApiSpecText);
            parseSpec(apiDoc).catch(console.error);
        }
    }, [openApiSpecText, upload]);

    function isSource(): boolean {
        const name: string = props.step.name;
        return name.includes('source');
    }

    const handleFileInputChange = (
        _event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>,
        file: File
    ) => {
        file.text().then((input) => {
            setOpenApiSpecText(input);
        });
    };

    function selectApiEndpoint(index: string) {
        const i = Number(index);
        setSelectedEndpoint(index);
        setCurrentEndpoint(endpoints.current[i]);
        constructUrl(endpoints.current[i]?.name);
    }

    const dropdownEndpointsItems: Array<ReactElement> = [];

    endpoints.current.forEach((e, index) => {
        dropdownEndpointsItems.push(
            <FormSelectOption key={e.name} value={index} label={e.name} isDisabled={false}/>
        );
    });

    const handleClear = (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setOpenApiSpecText('');
    };

    function setValue() {
        props.notifyKaoto(
            'updating the step'
        );
        props.updateStepParams(stepParams);
    }

    const handleLoadClick = () => {
        let url = new URL(apiSpecUrl);
        setBasePath(url.origin);
        parseSpec(apiSpecUrl).catch(console.error);
        constructUrl('');
    };

    const constructUrl = (urParameters: string, bPath?: string) => {
        setParamString(urParameters);
        const stepParamsTemp = stepParams;
        if (bPath !== undefined) {
            setBasePath(bPath);
            stepParamsTemp.url = bPath + urParameters;
        } else {
            stepParamsTemp.url = basePath + urParameters;
        }
        setStepParams(stepParamsTemp);
    };

    function setProduces(produces: string) {
        const params = stepParams;
        params.contentType = produces;
        setStepParams(params);
    }

    function calculateTime(unit: string) {
        const params = stepParams;
        const n = timeUnits.get(unit);
        setTImeUnit(unit);

        if (n) {
            params.period = periodInputValue * n;
            setStepParams(params);
        }
    }

    return (
        <Form>
            <FormGroup label="OpenApi" fieldId="open-api-file-upload">
                <Checkbox id="inputType" label="Upload spec" isChecked={upload} onChange={setUpload}/>

                {upload && (
                    <FileUpload
                        id="simple-file"
                        value={openApiSpecText}
                        filenamePlaceholder="Drag and drop a open API spec or upload one"
                        onFileInputChange={handleFileInputChange}
                        onClearClick={handleClear}
                        browseButtonText="Upload"
                    />
                )}
                {!upload && (
                    <InputGroup>
                        <TextInput
                            id="specUrlInput"
                            aria-label="Api spec url"
                            value={apiSpecUrl}
                            onChange={setApiUrl}
                        />
                        <Button onClick={handleLoadClick}>Load</Button>
                    </InputGroup>
                )}
            </FormGroup>
            <FormGroup label="Base Path">
                <Grid>
                    <GridItem span={6}>
                        <TextInput
                            id="basePathInput"
                            aria-label="Base path"
                            value={basePath}
                            onChange={(value: string) => {
                                constructUrl(paramString, value);
                            }}
                        />
                    </GridItem>
                    <GridItem span={6}>
                        <FormSelect
                            minLength={500}
                            type="text"
                            id="simple-form-note-01"
                            name="simple-form-number"
                            value={selectedEndpoint}
                            onChange={selectApiEndpoint}
                        >
                            {dropdownEndpointsItems}
                        </FormSelect>
                    </GridItem>
                </Grid>
            </FormGroup>
            {currentEndpoint?.name !== '' && (
                <HttpEndpoint
                    endpointUrl={currentEndpoint.name}
                    endpoint={currentEndpoint}
                    setUrl={constructUrl}
                    setProduces={setProduces}
                />
            )}


            <FormGroup label="Period">
                <Grid>
                    <GridItem span={4}>
                        <TextInput value={periodInputValue} onChange={setPeriodInputValue} type="number"
                                   aria-label="period"/>
                    </GridItem>
                    <GridItem span={8}>
                        <FormSelect

                            id="period-01"
                            name="simple-form-number"
                            value={timeUnit}
                            onChange={calculateTime}>
                            <FormSelectOption key='ms' value='ms' label='Miliseconds' isDisabled={false}/>
                            <FormSelectOption key='s' value='s' label='Seconds' isDisabled={false}/>
                            <FormSelectOption key='min' value='min' label='Minutes' isDisabled={false}/>
                            <FormSelectOption key='hour' value='hour' label='Hours' isDisabled={false}/>
                            <FormSelectOption key='day' value='day' label='Days' isDisabled={false}/>
                        </FormSelect>
                    </GridItem>
                </Grid>
            </FormGroup>
            <FormGroup label="URL">
                <TextInput value={stepParams.url} isReadOnly aria-label="url-read-only"/>
            </FormGroup>
            <FormGroup label="Content Type">
                <TextInput value={stepParams.contentType} isReadOnly aria-label="url-read-only"/>
            </FormGroup>
            <ActionGroup>
                <Button variant="primary" onClick={setValue}>
                    Apply
                </Button>
            </ActionGroup>

        </Form>
    );
};

export default HttpStep;
